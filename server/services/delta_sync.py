"""Sync Lakebase (PostgreSQL) scrum-demo data to UC Delta tables for Genie.

Creates/refreshes three Delta tables in `rxcorp.rxscrum_agent`:
  - stories       -> one row per JIRA story (from static config)
  - conversations -> one row per conversation session
  - assets        -> one row per Databricks asset created, with full UC path info

Called automatically after each conversation completes.
Can also be triggered manually via POST /api/genie/sync.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

CATALOG = os.getenv("DEFAULT_CATALOG", "rxcorp")
SCHEMA = "rxscrum_agent"
HOST = os.getenv("DATABRICKS_HOST", "").rstrip("/")
TOKEN = os.getenv("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.getenv("GENIE_WAREHOUSE_ID", "")


def _get_token() -> str:
    if TOKEN:
        return TOKEN
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        headers = w.config.authenticate()
        return headers["Authorization"].split(" ")[1]
    except Exception as e:
        raise RuntimeError(f"Cannot get Databricks token: {e}") from e


def _execute_sql(statements: list, token: str) -> None:
    """Execute SQL statements via the Databricks SQL Execute API."""
    import urllib.request

    warehouse_id = WAREHOUSE_ID or _find_warehouse(token)

    for sql in statements:
        payload = json.dumps({
            "statement": sql,
            "warehouse_id": warehouse_id,
            "wait_timeout": "30s",
        }).encode()
        req = urllib.request.Request(
            f"{HOST}/api/2.0/sql/statements",
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            state = result.get("status", {}).get("state", "")
            if state not in ("SUCCEEDED", "PENDING", "RUNNING"):
                error = result.get("status", {}).get("error", {})
                logger.warning(f"SQL state={state}: {error.get('message', '')}")


def _find_warehouse(token: str) -> str:
    import urllib.request
    req = urllib.request.Request(
        f"{HOST}/api/2.0/sql/warehouses",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    warehouses = data.get("warehouses", [])
    for wh in warehouses:
        if wh.get("state") in ("RUNNING", "STARTING"):
            return wh["id"]
    if warehouses:
        return warehouses[0]["id"]
    raise RuntimeError("No SQL warehouse found — set GENIE_WAREHOUSE_ID in app.yaml")


def _esc(value) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sync_to_delta(story_key=None) -> None:
    """Sync stories/conversations/assets from Lakebase to UC Delta tables."""
    if not HOST:
        logger.warning("Delta sync skipped: DATABRICKS_HOST not configured")
        return

    try:
        token = _get_token()
    except Exception as e:
        logger.warning(f"Delta sync skipped: {e}")
        return

    from ..db.database import SessionLocal
    from ..db.models import Conversation, Asset
    from ..stories.healthcare import STORIES, STORIES_BY_KEY

    db = SessionLocal()
    try:
        # Ensure schema + tables exist
        _execute_sql([
            f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}",
            f"""CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.stories (
                story_key STRING, summary STRING, description STRING,
                story_points INT, priority STRING, assignee STRING,
                story_type STRING, status STRING, sprint STRING, labels STRING
            ) USING DELTA""",
            f"""CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.conversations (
                id STRING, story_key STRING, story_summary STRING,
                assignee STRING, status STRING, session_number INT,
                message_count INT, created_at TIMESTAMP, updated_at TIMESTAMP
            ) USING DELTA""",
            f"""CREATE TABLE IF NOT EXISTS {CATALOG}.{SCHEMA}.assets (
                id STRING, conversation_id STRING, story_key STRING,
                story_summary STRING, assignee STRING, session_number INT,
                asset_type STRING, asset_name STRING, catalog STRING,
                schema_name STRING, full_path STRING, url STRING,
                description STRING, created_at TIMESTAMP
            ) USING DELTA""",
        ], token)

        # Sync stories (full overwrite — static data)
        story_rows = []
        for s in STORIES:
            story_rows.append(
                f"({_esc(s['key'])},{_esc(s['summary'])},{_esc(s['description'])},"
                f"{s.get('story_points', 0)},{_esc(s.get('priority','Medium'))},"
                f"{_esc(s.get('assignee',''))},{_esc(s.get('type','generic'))},"
                f"{_esc(s.get('status','todo'))},{_esc(s.get('sprint',''))},"
                f"{_esc(','.join(s.get('labels',[])))}"
                f")"
            )
        if story_rows:
            _execute_sql([
                f"DELETE FROM {CATALOG}.{SCHEMA}.stories",
                f"INSERT INTO {CATALOG}.{SCHEMA}.stories VALUES {','.join(story_rows)}",
            ], token)

        # Sync conversations
        story_filter = [story_key] if story_key else None
        q = db.query(Conversation)
        if story_filter:
            q = q.filter(Conversation.story_key.in_(story_filter))
        conversations = q.order_by(Conversation.story_key, Conversation.created_at).all()

        story_conv_idx = {}
        for conv in conversations:
            story_conv_idx[conv.story_key] = story_conv_idx.get(conv.story_key, 0) + 1
            conv._session_number = story_conv_idx[conv.story_key]

        if conversations:
            conv_rows = []
            for conv in conversations:
                meta = STORIES_BY_KEY.get(conv.story_key, {})
                conv_rows.append(
                    f"({_esc(conv.id)},{_esc(conv.story_key)},"
                    f"{_esc(meta.get('summary',''))},{_esc(meta.get('assignee',''))},"
                    f"{_esc(conv.status)},{conv._session_number},"
                    f"{len(conv.messages) if conv.messages else 0},"
                    f"CAST({_esc(conv.created_at.isoformat() if conv.created_at else None)} AS TIMESTAMP),"
                    f"CAST({_esc(conv.updated_at.isoformat() if conv.updated_at else None)} AS TIMESTAMP)"
                    f")"
                )
            affected = ",".join(_esc(k) for k in (story_filter or list({c.story_key for c in conversations})))
            _execute_sql([
                f"DELETE FROM {CATALOG}.{SCHEMA}.conversations WHERE story_key IN ({affected})",
                f"INSERT INTO {CATALOG}.{SCHEMA}.conversations VALUES {','.join(conv_rows)}",
            ], token)

        # Sync assets
        conv_session_map = {conv.id: conv._session_number for conv in conversations}
        q_assets = db.query(Asset)
        if story_filter:
            q_assets = q_assets.filter(Asset.story_key.in_(story_filter))
        assets = q_assets.order_by(Asset.story_key, Asset.created_at).all()

        if assets:
            asset_rows = []
            for a in assets:
                meta = STORIES_BY_KEY.get(a.story_key, {})
                asset_rows.append(
                    f"({_esc(a.id)},{_esc(a.conversation_id)},{_esc(a.story_key)},"
                    f"{_esc(meta.get('summary',''))},{_esc(meta.get('assignee',''))},"
                    f"{conv_session_map.get(a.conversation_id, 0)},"
                    f"{_esc(a.asset_type)},{_esc(a.name)},"
                    f"{_esc(a.catalog)},{_esc(a.schema_name)},{_esc(a.full_path)},"
                    f"{_esc(a.url)},{_esc(a.description)},"
                    f"CAST({_esc(a.created_at.isoformat() if a.created_at else None)} AS TIMESTAMP)"
                    f")"
                )
            affected = ",".join(_esc(k) for k in (story_filter or list({a.story_key for a in assets})))
            _execute_sql([
                f"DELETE FROM {CATALOG}.{SCHEMA}.assets WHERE story_key IN ({affected})",
                f"INSERT INTO {CATALOG}.{SCHEMA}.assets VALUES {','.join(asset_rows)}",
            ], token)

        logger.info(
            f"Delta sync complete: {len(STORIES)} stories, "
            f"{len(conversations)} conversations, {len(assets)} assets -> "
            f"{CATALOG}.{SCHEMA}"
        )
    except Exception as e:
        logger.error(f"Delta sync error: {e}")
    finally:
        db.close()
