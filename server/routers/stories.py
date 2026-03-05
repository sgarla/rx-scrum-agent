"""Stories API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..stories import get_all_stories, get_story, update_story_status, ASSIGNEES, SPRINTS

router = APIRouter()


@router.get("/stories")
async def list_stories(
    status: Optional[str] = Query(None, description="Filter: todo|building|done|all"),
    assignee: Optional[str] = Query(None, description="Filter by assignee name"),
    search: Optional[str] = Query(None, description="Search in key and summary"),
    sprint: Optional[str] = Query(None, description="Filter by sprint name"),
):
    stories = get_all_stories(status=status, assignee=assignee, search=search, sprint=sprint)
    return {
        "stories": stories,
        "total": len(stories),
        "assignees": ASSIGNEES,
        "sprints": SPRINTS,
    }


@router.get("/stories/{story_key}")
async def get_story_detail(story_key: str):
    story = get_story(story_key)
    if not story:
        raise HTTPException(status_code=404, detail=f"Story {story_key} not found")
    return story


@router.patch("/stories/{story_key}/status")
async def patch_story_status(story_key: str, body: dict):
    status = body.get("status")
    if status not in ("todo", "building", "done"):
        raise HTTPException(status_code=400, detail="status must be todo|building|done")
    updated = update_story_status(story_key, status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Story {story_key} not found")
    return {"success": True, "story_key": story_key, "status": status}
