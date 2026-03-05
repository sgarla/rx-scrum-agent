"""Genie API proxy — lets the frontend chat against the scrum-demo UC tables."""

import json
import logging
import os
import time
import urllib.request

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

HOST = os.getenv("DATABRICKS_HOST", "").rstrip("/")
GENIE_SPACE_ID = os.getenv("GENIE_SPACE_ID", "")


def _get_token() -> str:
    token = os.getenv("DATABRICKS_TOKEN", "")
    if token:
        return token
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        headers = w.config.authenticate()
        return headers["Authorization"].split(" ")[1]
    except Exception as e:
        raise RuntimeError(f"Cannot get Databricks token: {e}") from e


def _api(path: str, method: str = "GET", body: dict | None = None) -> dict:
    token = _get_token()
    payload = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f"{HOST}{path}",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


class GenieAskRequest(BaseModel):
    message: str
    conversation_id: str | None = None


@router.get("/genie/status")
async def genie_status():
    """Check if Genie is configured."""
    return {
        "configured": bool(HOST and GENIE_SPACE_ID),
        "space_id": GENIE_SPACE_ID or None,
        "host": HOST or None,
    }


@router.post("/genie/ask")
async def genie_ask(body: GenieAskRequest):
    """Send a message to the Genie space and return the response."""
    if not HOST or not GENIE_SPACE_ID:
        raise HTTPException(
            status_code=503,
            detail="Genie not configured. Set GENIE_SPACE_ID in app.yaml."
        )

    try:
        # Start or continue a conversation
        if body.conversation_id:
            # Continue existing conversation
            msg_resp = _api(
                f"/api/2.0/genie/spaces/{GENIE_SPACE_ID}/conversations/{body.conversation_id}/messages",
                method="POST",
                body={"content": body.message},
            )
            conversation_id = body.conversation_id
        else:
            # Start a new conversation
            msg_resp = _api(
                f"/api/2.0/genie/spaces/{GENIE_SPACE_ID}/start-conversation",
                method="POST",
                body={"content": body.message},
            )
            conversation_id = msg_resp.get("conversation_id", "")

        message_id = msg_resp.get("message_id", "")

        # Poll for the response (max 60s)
        answer_text = ""
        sql_query = None
        for _ in range(60):
            time.sleep(1)
            poll = _api(
                f"/api/2.0/genie/spaces/{GENIE_SPACE_ID}/conversations/{conversation_id}/messages/{message_id}"
            )
            status = poll.get("status", "")
            if status in ("EXECUTING_QUERY", "COMPLETED"):
                # Extract text answer
                for attachment in poll.get("attachments", []):
                    if attachment.get("text"):
                        answer_text = attachment["text"].get("content", "")
                    if attachment.get("query"):
                        sql_query = attachment["query"].get("query", "")
                if status == "COMPLETED":
                    break
            elif status in ("FAILED", "CANCELLED"):
                error_msg = poll.get("error", {}).get("message", "Genie query failed")
                raise HTTPException(status_code=500, detail=error_msg)

        return {
            "conversation_id": conversation_id,
            "message_id": message_id,
            "answer": answer_text or "No answer returned from Genie.",
            "sql": sql_query,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Genie error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/genie/sync")
async def genie_sync():
    """Manually trigger Delta sync for all stories."""
    try:
        from ..services.delta_sync import sync_to_delta
        sync_to_delta()
        return {"status": "ok", "message": f"Synced to healthcare_demo.scrum_demo"}
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
