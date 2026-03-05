"""Assets API endpoints — Databricks resources created by the agent."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db, Conversation, Message, Asset
from ..services.assets_parser import extract_assets
from ..stories import STORIES_BY_KEY

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/conversations/{conversation_id}/assets")
async def list_conversation_assets(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "conversation_id": conversation_id,
        "story_key": conv.story_key,
        "assets": [a.to_dict() for a in conv.assets],
    }


@router.get("/stories/{story_key}/assets")
async def list_story_assets(story_key: str, db: Session = Depends(get_db)):
    """Get all assets for a story across all conversations, grouped into chronological sessions."""
    # Fetch conversations for this story in creation order
    conversations = (
        db.query(Conversation)
        .filter(Conversation.story_key == story_key)
        .order_by(Conversation.created_at)
        .all()
    )
    conv_index = {c.id: i + 1 for i, c in enumerate(conversations)}
    conv_ts = {c.id: c.created_at.isoformat() if c.created_at else None for c in conversations}

    # Fetch all assets for the story ordered chronologically
    assets = (
        db.query(Asset)
        .filter(Asset.story_key == story_key)
        .order_by(Asset.created_at)
        .all()
    )

    # Enrich each asset with session number and conversation timestamp
    enriched = []
    for a in assets:
        d = a.to_dict()
        d["session_number"] = conv_index.get(a.conversation_id, 0)
        d["session_created_at"] = conv_ts.get(a.conversation_id)
        enriched.append(d)

    return {
        "story_key": story_key,
        "session_count": len(conversations),
        "assets": enriched,
    }


@router.post("/stories/{story_key}/reparse-assets")
async def reparse_story_assets(story_key: str, db: Session = Depends(get_db)):
    """Re-parse conversation message history to extract and save assets.

    - Conversations that already have assets are skipped (no duplicates).
    - Conversations with no assets have their stored message text re-parsed.
    Returns the full updated asset list for the story.
    """
    conversations = (
        db.query(Conversation)
        .filter(Conversation.story_key == story_key)
        .order_by(Conversation.created_at)
        .all()
    )

    new_assets_count = 0
    for conv in conversations:
        # Skip conversations that already have assets
        existing = db.query(Asset).filter(Asset.conversation_id == conv.id).count()
        if existing > 0:
            continue

        # Concatenate all assistant text messages for this conversation
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id, Message.role == "assistant", Message.message_type == "text")
            .order_by(Message.created_at)
            .all()
        )
        full_text = "\n".join(m.content for m in messages if m.content)
        if not full_text.strip():
            continue

        assets = extract_assets(full_text)
        for asset_data in assets:
            db.add(Asset(
                conversation_id=conv.id,
                story_key=story_key,
                asset_type=asset_data["type"],
                name=asset_data["name"],
                url=asset_data.get("url"),
                description=asset_data.get("description"),
                catalog=asset_data.get("catalog"),
                schema_name=asset_data.get("schema_name"),
                full_path=asset_data.get("full_path"),
            ))
            new_assets_count += 1

        if assets:
            db.commit()
            logger.info(f"Reparsed {len(assets)} assets for conversation {conv.id[:8]} (story {story_key})")

    # Return the full story asset list (same format as GET /stories/{story_key}/assets)
    conversations = (
        db.query(Conversation)
        .filter(Conversation.story_key == story_key)
        .order_by(Conversation.created_at)
        .all()
    )
    conv_index = {c.id: i + 1 for i, c in enumerate(conversations)}
    conv_ts = {c.id: c.created_at.isoformat() if c.created_at else None for c in conversations}

    all_assets = (
        db.query(Asset)
        .filter(Asset.story_key == story_key)
        .order_by(Asset.created_at)
        .all()
    )
    enriched = []
    for a in all_assets:
        d = a.to_dict()
        d["session_number"] = conv_index.get(a.conversation_id, 0)
        d["session_created_at"] = conv_ts.get(a.conversation_id)
        enriched.append(d)

    return {
        "story_key": story_key,
        "session_count": len(conversations),
        "assets": enriched,
        "new_assets_found": new_assets_count,
    }


@router.get("/assets")
async def list_all_assets(db: Session = Depends(get_db)):
    """Get all assets, grouped by story key."""
    assets = db.query(Asset).order_by(Asset.story_key, Asset.created_at).all()
    grouped: dict[str, list] = {}
    for asset in assets:
        grouped.setdefault(asset.story_key, []).append(asset.to_dict())

    result = []
    for story_key, asset_list in grouped.items():
        story = STORIES_BY_KEY.get(story_key, {})
        result.append({
            "story_key": story_key,
            "story_summary": story.get("summary", ""),
            "assignee": story.get("assignee", ""),
            "assets": asset_list,
        })

    return {"groups": result, "total_assets": sum(len(g["assets"]) for g in result)}
