"""Rally user stories API — list and fetch stories for the configured project."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.rally import get_story_by_key, list_stories

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/rally/stories")
async def fetch_rally_stories(
    state: str = Query("active", description="active|completed|all"),
    search: str = Query("", description="Client-side filter on name/id/description"),
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    try:
        return list_stories(db, state=state, search=search, limit=limit, page=page)
    except Exception as e:
        logger.exception("fetch_rally_stories failed: %s", e)
        return {
            "stories": [],
            "total": 0,
            "configured": False,
            "error": f"{type(e).__name__}: {e}",
        }


@router.get("/rally/stories/by-key/{story_key:path}")
async def fetch_rally_story_by_key(story_key: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException

    story = get_story_by_key(db, story_key)
    if story is None:
        raise HTTPException(status_code=404, detail=f"Rally story not found: {story_key}")
    return story
