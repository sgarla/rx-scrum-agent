"""Settings API — store/retrieve app configuration (ServiceNow connection, etc.)."""

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db, Setting
from ..services.servicenow import test_connection
from ..services.github import test_github_connection

logger = logging.getLogger(__name__)

router = APIRouter()

# Keys we expose (never return passwords directly in GET, only presence)
_SERVICENOW_KEYS = [
    "snow_instance",
    "snow_username",
    "snow_password",
    "snow_filter",
]

_GITHUB_KEYS = [
    "github_token",
    "github_repo",
]

_ALL_SETTING_KEYS = _SERVICENOW_KEYS + _GITHUB_KEYS


@router.get("/settings")
async def get_settings(db: Session = Depends(get_db)):
    """Get current app settings. Passwords/tokens are masked."""
    rows = db.query(Setting).filter(Setting.key.in_(_ALL_SETTING_KEYS)).all()
    data = {r.key: r.value for r in rows}
    snow_ok = bool(data.get("snow_instance") and data.get("snow_username") and data.get("snow_password"))
    gh_ok = bool(data.get("github_token", "").strip() and data.get("github_repo", "").strip())
    return {
        "snow_instance": data.get("snow_instance", ""),
        "snow_username": data.get("snow_username", ""),
        "snow_password_set": bool(data.get("snow_password", "")),
        "snow_filter": data.get("snow_filter", ""),
        "configured": snow_ok,
        "github_repo": data.get("github_repo", ""),
        "github_token_set": bool(data.get("github_token", "")),
        "github_configured": gh_ok,
    }


@router.put("/settings")
async def update_settings(payload: dict, db: Session = Depends(get_db)):
    """Save settings. Only keys present in the payload are updated."""
    allowed = {"snow_instance", "snow_username", "snow_password", "snow_filter", "github_token", "github_repo"}
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

@router.post("/settings/test-github")
async def test_github_conn(payload: dict, db: Session = Depends(get_db)):
    """Test GitHub token + repo."""
    from ..db import Setting as SettingModel
    stored = {r.key: r.value for r in db.query(SettingModel).filter(SettingModel.key.in_(_GITHUB_KEYS)).all()}
    token = payload.get("github_token") or stored.get("github_token", "")
    repo = payload.get("github_repo") or stored.get("github_repo", "")
    return test_github_connection(token, repo)
