"""Agent invocation and SSE streaming endpoints."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db, Conversation, Message, Asset
from ..services.agent import start_agent_build
from ..services.assets_parser import extract_assets
from ..services import stream_manager
from ..stories import get_story, update_story_status

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateConversationRequest(BaseModel):
    story_key: str


class InvokeAgentRequest(BaseModel):
    conversation_id: str
    message: str
    mode: str = 'agent'  # 'plan' | 'agent'


@router.post("/conversations")
async def create_conversation(body: CreateConversationRequest, db: Session = Depends(get_db)):
    """Create a conversation for a JIRA story."""
    story = get_story(body.story_key)
    if not story:
        raise HTTPException(status_code=404, detail=f"Story {body.story_key} not found")

    conv = Conversation(
        story_key=body.story_key,
        story_json=json.dumps(story),
        status="idle",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv.to_dict()


@router.get("/conversations/{conversation_id}/status")
async def get_conversation_status(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    data = conv.to_dict()
    # Check live execution status
    active = stream_manager.get_execution_by_conversation(conversation_id)
    if active and not active.is_done:
        data["status"] = "building"
        data["execution_id"] = active.execution_id
    return data


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        **conv.to_dict(),
        "messages": [m.to_dict() for m in conv.messages],
    }


@router.get("/conversations")
async def list_conversations(story_key: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Conversation)
    if story_key:
        q = q.filter(Conversation.story_key == story_key)
    convs = q.order_by(Conversation.created_at.desc()).all()
    # Return summaries with latest active execution status
    result = []
    for c in convs:
        data = c.to_dict()
        # Check for an active execution in stream_manager
        active = stream_manager.get_execution_by_conversation(c.id)
        if active and not active.is_done:
            data["status"] = "building"
        result.append(data)
    return {"conversations": result}


@router.post("/invoke_agent")
async def invoke_agent(body: InvokeAgentRequest, db: Session = Depends(get_db)):
    """Start an agent build and return execution_id for SSE streaming."""
    conv = db.query(Conversation).filter(Conversation.id == body.conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check for an already-running build for this conversation
    existing = stream_manager.get_execution_by_conversation(body.conversation_id)
    if existing and not existing.is_done:
        return {"execution_id": existing.execution_id, "status": "already_running"}

    story = json.loads(conv.story_json)

    # Build message history (existing messages + new user message)
    existing_msgs = [{"role": m.role, "content": m.content} for m in conv.messages]
    new_message = {"role": "user", "content": body.message}
    messages = existing_msgs + [new_message]

    # Persist the user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=body.message,
        message_type="text",
    )
    db.add(user_msg)

    # Update conversation status (only show "building" in agent mode — plan mode is conversational)
    conv.status = "building"
    if body.mode == 'agent':
        update_story_status(conv.story_key, "building")
    db.commit()

    # Create execution in stream manager
    execution_id = stream_manager.create_execution(conv.id, conv.story_key)
    exec_state = stream_manager.get_execution(execution_id)

    # Build save callback BEFORE starting the thread so the thread captures it.
    # Runs synchronously inside the agent thread after the agent finishes,
    # BEFORE the done sentinel fires — mirroring the builder-app pattern.
    # This guarantees messages are in Lakebase when the frontend reloads,
    # even if the server restarts immediately after.
    _conv_id = conv.id
    _story_key = conv.story_key

    def _save_on_complete():
        """Sync DB save — called from agent thread before done sentinel."""
        from ..db.database import SessionLocal
        _db = SessionLocal()
        try:
            _conv_row = _db.query(Conversation).filter(Conversation.id == _conv_id).first()
            if not _conv_row:
                return

            exec_st = stream_manager.get_execution(execution_id)
            if not exec_st:
                return

            try:
                from claude_agent_sdk.types import (
                    AssistantMessage, ResultMessage, TextBlock, ToolUseBlock,
                )
            except ImportError:
                return

            full_text = ""
            final_session_id = _conv_row.session_id

            for event in exec_st.all_events:
                if isinstance(event, AssistantMessage):
                    for block in event.content:
                        if isinstance(block, TextBlock):
                            full_text += block.text
                            _db.add(Message(
                                conversation_id=_conv_id,
                                role="assistant",
                                content=block.text,
                                message_type="text",
                            ))
                        elif isinstance(block, ToolUseBlock):
                            _db.add(Message(
                                conversation_id=_conv_id,
                                role="assistant",
                                content=f"Using tool: {block.name}",
                                message_type="tool_use",
                                metadata_json=json.dumps({
                                    "tool_name": block.name,
                                    "tool_id": block.id,
                                    "input": block.input,
                                }),
                            ))
                elif isinstance(event, ResultMessage):
                    if hasattr(event, "session_id") and event.session_id:
                        final_session_id = event.session_id

            _conv_row.session_id = final_session_id
            _conv_row.status = "idle"
            # Story status reverts to "todo" after agent completes — user must explicitly mark as Done

            assets = extract_assets(full_text)
            for asset_data in assets:
                _db.add(Asset(
                    conversation_id=_conv_id,
                    story_key=_story_key,
                    asset_type=asset_data["type"],
                    name=asset_data["name"],
                    url=asset_data.get("url"),
                    description=asset_data.get("description"),
                    catalog=asset_data.get("catalog"),
                    schema_name=asset_data.get("schema_name"),
                    full_path=asset_data.get("full_path"),
                ))

            _db.commit()

            # Trigger Delta sync to UC tables for Genie
            try:
                from ..services.delta_sync import sync_to_delta
                sync_to_delta(_story_key)
            except Exception as _sync_err:
                logger.warning(f"Delta sync skipped: {_sync_err}")

            logger.info(
                f"Saved conversation {_conv_id[:8]}: "
                f"{len(assets)} assets, session_id={final_session_id[:16] if final_session_id else None}"
            )
        except Exception as e:
            logger.exception(f"Error saving conversation {_conv_id}: {e}")
            _db.rollback()
        finally:
            _db.close()

    # Start agent background thread
    thread = start_agent_build(
        story=story,
        messages=messages,
        session_id=conv.session_id,
        conversation_id=conv.id,
        put_event=exec_state.put_event,
        on_complete=_save_on_complete,
        mode=body.mode,
    )
    stream_manager.set_execution_thread(execution_id, thread)

    return {"execution_id": execution_id, "conversation_id": conv.id, "status": "started"}


@router.get("/stream_progress/{execution_id}")
async def stream_progress(
    execution_id: str,
    last_event_index: int = 0,
):
    """SSE stream of agent events. Reconnect with last_event_index to resume."""
    exec_state = stream_manager.get_execution(execution_id)
    if not exec_state:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")

    return StreamingResponse(
        stream_manager.stream_events(execution_id, last_event_index),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/stop/{execution_id}")
async def stop_execution(execution_id: str, db: Session = Depends(get_db)):
    """Cancel a running agent execution."""
    exec_state = stream_manager.get_execution(execution_id)
    if not exec_state:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")

    exec_state.cancel()

    # Update conversation status
    conv = db.query(Conversation).filter(
        Conversation.id == exec_state.conversation_id
    ).first()
    if conv:
        conv.status = "idle"
        db.commit()

    return {"execution_id": execution_id, "status": "cancelled"}
