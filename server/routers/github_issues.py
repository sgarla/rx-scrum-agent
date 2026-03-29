"""GitHub issues API — list and fetch issues for the configured repository."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.github import get_issue_by_key, list_issues

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/github/issues")
async def fetch_github_issues(
    state: str = Query("open", description="open|closed|all"),
    search: str = Query("", description="Search (uses GitHub search when non-empty)"),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    result = list_issues(db, state=state, search=search, limit=limit, page=page)
    return result


@router.get("/github/issues/by-key/{story_key:path}")
async def fetch_github_issue_by_key(story_key: str, db: Session = Depends(get_db)):
    """Get issue by gh:owner/repo#num key."""
    issue = get_issue_by_key(db, story_key)
    if issue is None:
        raise HTTPException(status_code=404, detail=f"Issue not found: {story_key}")
    return issue
