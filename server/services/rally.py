"""Rally (Broadcom Agile Central) WSAPI v2.0 client for user stories."""

from __future__ import annotations

import logging
import re
from typing import Any
import httpx

logger = logging.getLogger(__name__)

RALLY_BASE = "https://rally1.rallydev.com/slm/webservice/v2.0"

RALLY_API_KEY = "rally_api_key"
RALLY_WORKSPACE = "rally_workspace"
RALLY_PROJECT = "rally_project"
RALLY_ITERATION = "rally_iteration"

_FETCH_HR = (
    "FormattedID,Name,Description,ScheduleState,Iteration,Project,Owner,"
    "PlanEstimate,Priority,Tags"
)


def _get_rally_settings(db) -> dict[str, str]:
    from ..db import Setting

    keys = [RALLY_API_KEY, RALLY_WORKSPACE, RALLY_PROJECT, RALLY_ITERATION]
    rows = db.query(Setting).filter(Setting.key.in_(keys)).all()
    return {r.key: (r.value or "") for r in rows}


def is_rally_configured(db) -> bool:
    s = _get_rally_settings(db)
    return bool(
        s.get(RALLY_API_KEY, "").strip()
        and s.get(RALLY_WORKSPACE, "").strip()
        and s.get(RALLY_PROJECT, "").strip()
    )


def _headers(api_key: str) -> dict[str, str]:
    return {
        "ZSESSIONID": api_key.strip(),
        "Content-Type": "application/json",
    }


def _ws_get(client: httpx.Client, path: str, params: dict[str, Any]) -> dict[str, Any]:
    url = f"{RALLY_BASE}/{path.lstrip('/')}"
    r = client.get(url, params=params, timeout=45.0)
    r.raise_for_status()
    return r.json()


def _escape_rally_string(s: str) -> str:
    return s.replace('"', '\\"')


def _find_workspace_ref(client: httpx.Client, api_key: str, workspace_name: str) -> str | None:
    q = f'(Name = "{_escape_rally_string(workspace_name.strip())}")'
    data = _ws_get(client, "workspace", {"query": q, "fetch": "Name,ObjectID", "pagesize": 20})
    results = (data.get("QueryResult") or {}).get("Results") or []
    if not results:
        return None
    return results[0].get("_ref") or results[0].get("Ref")


def _find_project_ref(
    client: httpx.Client, api_key: str, workspace_ref: str, project_name: str
) -> str | None:
    # Project is scoped to workspace
    q = (
        f'((Workspace = "{workspace_ref}") AND '
        f'(Name = "{_escape_rally_string(project_name.strip())}"))'
    )
    data = _ws_get(client, "project", {"query": q, "fetch": "Name,ObjectID,Workspace", "pagesize": 20})
    results = (data.get("QueryResult") or {}).get("Results") or []
    if not results:
        return None
    return results[0].get("_ref") or results[0].get("Ref")


def test_rally_connection(
    api_key: str,
    workspace: str,
    project: str,
    iteration: str | None = None,
) -> dict[str, Any]:
    api_key = (api_key or "").strip()
    workspace = (workspace or "").strip()
    project = (project or "").strip()
    iteration = (iteration or "").strip() or None

    if not api_key:
        return {"ok": False, "error": "Rally API key is required"}
    if not workspace:
        return {"ok": False, "error": "Workspace name is required"}
    if not project:
        return {"ok": False, "error": "Project / Team name is required"}

    try:
        with httpx.Client(headers=_headers(api_key)) as client:
            r = client.get(f"{RALLY_BASE}/user", timeout=20.0)
            if r.status_code == 401:
                return {"ok": False, "error": "Invalid or expired Rally API key"}
            r.raise_for_status()

            ws_ref = _find_workspace_ref(client, api_key, workspace)
            if not ws_ref:
                return {"ok": False, "error": f'Workspace not found: "{workspace}"'}

            proj_ref = _find_project_ref(client, api_key, ws_ref, project)
            if not proj_ref:
                return {
                    "ok": False,
                    "error": f'Project not found in workspace: "{project}"',
                }

            if iteration:
                iq = (
                    f'((Project = "{proj_ref}") AND '
                    f'(Name = "{_escape_rally_string(iteration)}"))'
                )
                idata = _ws_get(
                    client,
                    "iteration",
                    {"query": iq, "fetch": "Name,ObjectID", "pagesize": 20},
                )
                ires = (idata.get("QueryResult") or {}).get("Results") or []
                if not ires:
                    return {
                        "ok": False,
                        "error": f'Iteration not found for project: "{iteration}"',
                    }

            return {"ok": True, "error": None, "workspace_ref": ws_ref, "project_ref": proj_ref}
    except httpx.HTTPError as e:
        logger.warning("Rally test HTTP error: %s: %s", type(e).__name__, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
    except Exception as e:
        logger.warning("Rally test error: %s: %s", type(e).__name__, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


def _ref_name(obj: Any) -> str:
    if not obj:
        return ""
    if isinstance(obj, dict):
        return str(obj.get("_refObjectName") or obj.get("Name") or "")
    return ""


def _normalize_hr(raw: dict[str, Any]) -> dict[str, Any]:
    fid = raw.get("FormattedID") or ""
    iteration = raw.get("Iteration")
    owner = raw.get("Owner")
    raw_tags = raw.get("Tags")
    tag_list: list[str] = []
    if isinstance(raw_tags, str):
        tag_list = [t.strip() for t in raw_tags.split(",") if t.strip()]
    elif isinstance(raw_tags, list):
        for t in raw_tags:
            if isinstance(t, dict):
                n = t.get("Name") or t.get("_refObjectName") or ""
                if n:
                    tag_list.append(str(n))
            elif t:
                tag_list.append(str(t))

    state = str(raw.get("ScheduleState") or "")
    plan = raw.get("PlanEstimate")
    try:
        pts = float(plan) if plan is not None and plan != "" else 0.0
    except (TypeError, ValueError):
        pts = 0.0

    pri_raw = raw.get("Priority")
    if isinstance(pri_raw, dict):
        pri = str(pri_raw.get("_refObjectName") or pri_raw.get("Name") or "Medium")
    else:
        pri = str(pri_raw or "Medium")
    if pri and pri not in ("Critical", "High", "Medium", "Low"):
        pl = pri.lower()
        if "critical" in pl or "p1" in pl:
            pri = "Critical"
        elif "high" in pl or "p2" in pl:
            pri = "High"
        elif "low" in pl:
            pri = "Low"
        else:
            pri = "Medium"

    return {
        "key": f"rally:{fid}",
        "formatted_id": fid,
        "name": raw.get("Name") or "",
        "description": raw.get("Description") or "",
        "schedule_state": state,
        "iteration_name": _ref_name(iteration),
        "owner_name": _ref_name(owner),
        "plan_estimate": pts,
        "priority": pri if pri in ("Critical", "High", "Medium", "Low") else "Medium",
        "tags": tag_list,
        "rally_url": raw.get("_ref") or "",
    }


def _build_hr_query(project_ref: str, iteration_name: str | None, state: str) -> str:
    clauses = [f'(Project = "{project_ref}")']
    if iteration_name and iteration_name.strip():
        clauses.append(
            f'(Iteration.Name = "{_escape_rally_string(iteration_name.strip())}")'
        )
    s = (state or "active").lower()
    if s == "completed":
        clauses.append('(ScheduleState = "Completed")')
    elif s == "active":
        clauses.append('(ScheduleState != "Completed")')
    return "(" + " AND ".join(clauses) + ")"


def list_stories(
    db,
    *,
    state: str = "active",
    search: str = "",
    limit: int = 50,
    page: int = 1,
) -> dict[str, Any]:
    settings = _get_rally_settings(db)
    api_key = settings.get(RALLY_API_KEY, "").strip()
    workspace = settings.get(RALLY_WORKSPACE, "").strip()
    project_name = settings.get(RALLY_PROJECT, "").strip()
    iteration_name = settings.get(RALLY_ITERATION, "").strip()

    if not api_key or not workspace or not project_name:
        return {
            "stories": [],
            "total": 0,
            "configured": False,
            "error": "Rally is not configured. Add API key, workspace, and project in Settings.",
        }

    try:
        with httpx.Client(headers=_headers(api_key)) as client:
            ws_ref = _find_workspace_ref(client, api_key, workspace)
            if not ws_ref:
                return {
                    "stories": [],
                    "total": 0,
                    "configured": True,
                    "error": f'Workspace not found: "{workspace}"',
                }
            proj_ref = _find_project_ref(client, api_key, ws_ref, project_name)
            if not proj_ref:
                return {
                    "stories": [],
                    "total": 0,
                    "configured": True,
                    "error": f'Project not found: "{project_name}"',
                }

            q = _build_hr_query(proj_ref, iteration_name or None, state)
            start = max(1, (page - 1) * limit + 1)
            data = _ws_get(
                client,
                "hierarchicalrequirement",
                {
                    "query": q,
                    "fetch": _FETCH_HR,
                    "pagesize": min(max(limit, 1), 200),
                    "start": start,
                    "order": "Rank",
                },
            )
            qr = data.get("QueryResult") or {}
            raw_list = qr.get("Results") or []
            total = int(qr.get("TotalResultCount") or len(raw_list))

            out = [_normalize_hr(x) for x in raw_list if isinstance(x, dict)]
            if search.strip():
                sq = search.strip().lower()
                out = [
                    s
                    for s in out
                    if sq in (s.get("name") or "").lower()
                    or sq in (s.get("formatted_id") or "").lower()
                    or sq in (s.get("description") or "").lower()
                ]

            return {
                "stories": out,
                "total": total,
                "configured": True,
                "error": None,
            }
    except Exception as e:
        logger.exception("Rally list_stories failed: %s", e)
        return {
            "stories": [],
            "total": 0,
            "configured": True,
            "error": f"{type(e).__name__}: {e}",
        }


RALLY_KEY_RE = re.compile(r"^rally:([A-Z]{1,4}\d+)$", re.IGNORECASE)


def parse_rally_story_key(story_key: str) -> str | None:
    m = RALLY_KEY_RE.match(str(story_key).strip())
    if not m:
        return None
    return m.group(1).upper()


def get_story_by_key(db, story_key: str) -> dict[str, Any] | None:
    fid = parse_rally_story_key(story_key)
    if not fid:
        return None
    settings = _get_rally_settings(db)
    api_key = settings.get(RALLY_API_KEY, "").strip()
    workspace = settings.get(RALLY_WORKSPACE, "").strip()
    project_name = settings.get(RALLY_PROJECT, "").strip()
    if not api_key or not workspace or not project_name:
        return None

    try:
        with httpx.Client(headers=_headers(api_key)) as client:
            ws_ref = _find_workspace_ref(client, api_key, workspace)
            if not ws_ref:
                return None
            proj_ref = _find_project_ref(client, api_key, ws_ref, project_name)
            if not proj_ref:
                return None

            q = (
                f'((Project = "{proj_ref}") AND (FormattedID = "{_escape_rally_string(fid)}"))'
            )
            data = _ws_get(
                client,
                "hierarchicalrequirement",
                {"query": q, "fetch": _FETCH_HR, "pagesize": 5},
            )
            results = (data.get("QueryResult") or {}).get("Results") or []
            if not results:
                return None
            return _normalize_hr(results[0])
    except Exception as e:
        logger.warning("get_story_by_key failed: %s", e)
        return None


def rally_story_to_agent_dict(normalized: dict[str, Any]) -> dict[str, Any]:
    """Shape for Conversation.story_json and agent prompts."""
    fid = normalized.get("formatted_id") or ""
    name = normalized.get("name") or ""
    desc = normalized.get("description") or ""
    return {
        "key": normalized.get("key") or f"rally:{fid}",
        "type": "rally_story",
        "summary": name,
        "description": desc,
        "title": name,
        "body": desc,
        "rally_formatted_id": fid,
        "schedule_state": normalized.get("schedule_state") or "",
        "iteration_name": normalized.get("iteration_name") or "",
        "owner_name": normalized.get("owner_name") or "",
        "assignee": normalized.get("owner_name") or "Unassigned",
        "priority": normalized.get("priority") or "Medium",
        "story_points": int(normalized.get("plan_estimate") or 0),
        "labels": normalized.get("tags") or [],
        "acceptance_criteria": [],
        "skill_hint": "databricks-docs",
    }
