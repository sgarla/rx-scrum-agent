"""Assets API endpoints — Databricks resources created by the agent."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db, Conversation, Asset
from ..stories import STORIES_BY_KEY

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
