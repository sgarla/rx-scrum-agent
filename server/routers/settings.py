"""Settings API — store/retrieve app configuration (ServiceNow connection, etc.)."""

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db, Setting
from ..services.servicenow import test_connection

logger = logging.getLogger(__name__)

router = APIRouter()

# Keys we expose (never return passwords directly in GET, only presence)
_SERVICENOW_KEYS = [
    "snow_instance",
    "snow_username",
    "snow_password",
    "snow_filter",
]


@router.get("/settings")
async def get_settings(db: Session = Depends(get_db)):
    """Get current app settings. Password is masked."""
    rows = db.query(Setting).filter(Setting.key.in_(_SERVICENOW_KEYS)).all()
    data = {r.key: r.value for r in rows}
    return {
        "snow_instance": data.get("snow_instance", ""),
        "snow_username": data.get("snow_username", ""),
        "snow_password_set": bool(data.get("snow_password", "")),
        "snow_filter": data.get("snow_filter", ""),
        "configured": bool(data.get("snow_instance") and data.get("snow_username") and data.get("snow_password")),
    }


@router.put("/settings")
async def update_settings(payload: dict, db: Session = Depends(get_db)):
    """Save settings. Only keys present in the payload are updated."""
    allowed = {"snow_instance", "snow_username", "snow_password", "snow_filter"}
    for key, value in payload.items():
        if key not in allowed:
            continue
        row = db.query(Setting).filter(Setting.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return {"ok": True}


@router.post("/settings/test-connection")
async def test_snow_connection(payload: dict, db: Session = Depends(get_db)):
    """Test ServiceNow connection with provided or stored credentials."""
    # Allow testing with supplied creds (not yet saved) or fall back to DB
    from ..db import Setting as SettingModel
    stored = {r.key: r.value for r in db.query(SettingModel).filter(SettingModel.key.in_(_SERVICENOW_KEYS)).all()}

    instance = payload.get("snow_instance") or stored.get("snow_instance", "")
    username = payload.get("snow_username") or stored.get("snow_username", "")
    password = payload.get("snow_password") or stored.get("snow_password", "")

    if not instance or not username or not password:
        return {"ok": False, "error": "Instance URL, username, and password are required"}

    result = test_connection(instance, username, password)
    return result
