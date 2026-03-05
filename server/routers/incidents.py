"""Incidents API — fetch ServiceNow incidents and serve them like stories."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.servicenow import list_incidents, get_incident

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/incidents")
async def fetch_incidents(
    search: str = Query("", description="Search in number or short_description"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List ServiceNow incidents. Returns empty list if not configured."""
    result = list_incidents(db, limit=limit, offset=offset, search=search)
    return result


@router.get("/incidents/{number}")
async def fetch_incident(number: str, db: Session = Depends(get_db)):
    """Get a single incident by number (e.g. INC0010001)."""
    incident = get_incident(db, number)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {number} not found")
    return incident
