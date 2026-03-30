"""Settings API — store/retrieve app configuration (ServiceNow connection, etc.)."""

import json
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db, Setting
from ..services.servicenow import test_connection
from ..services.github import test_github_connection
from ..services.rally import test_rally_connection

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

_RALLY_KEYS = [
    "rally_api_key",
    "rally_workspace",
    "rally_project",
    "rally_iteration",
]

_ALL_SETTING_KEYS = _SERVICENOW_KEYS + _GITHUB_KEYS + _RALLY_KEYS


@router.get("/settings")
async def get_settings(db: Session = Depends(get_db)):
    """Get current app settings. Passwords/tokens are masked."""
    rows = db.query(Setting).filter(Setting.key.in_(_ALL_SETTING_KEYS)).all()
    data = {r.key: r.value for r in rows}
    snow_ok = bool(data.get("snow_instance") and data.get("snow_username") and data.get("snow_password"))
    gh_ok = bool(data.get("github_token", "").strip() and data.get("github_repo", "").strip())
    rally_ok = bool(
        data.get("rally_api_key", "").strip()
        and data.get("rally_workspace", "").strip()
        and data.get("rally_project", "").strip()
    )
    return {
        "snow_instance": data.get("snow_instance", ""),
        "snow_username": data.get("snow_username", ""),
        "snow_password_set": bool(data.get("snow_password", "")),
        "snow_filter": data.get("snow_filter", ""),
        "configured": snow_ok,
        "github_repo": data.get("github_repo", ""),
        "github_token_set": bool(data.get("github_token", "")),
        "github_configured": gh_ok,
        "rally_workspace": data.get("rally_workspace", ""),
        "rally_project": data.get("rally_project", ""),
        "rally_iteration": data.get("rally_iteration", ""),
        "rally_api_key_set": bool(data.get("rally_api_key", "")),
        "rally_configured": rally_ok,
    }


@router.put("/settings")
async def update_settings(payload: dict, db: Session = Depends(get_db)):
    """Save settings. Only keys present in the payload are updated."""
    allowed = {
        "snow_instance",
        "snow_username",
        "snow_password",
        "snow_filter",
        "github_token",
        "github_repo",
        "rally_api_key",
        "rally_workspace",
        "rally_project",
        "rally_iteration",
    }
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
    try:
        from ..db import Setting as SettingModel
        stored = {r.key: r.value for r in db.query(SettingModel).filter(SettingModel.key.in_(_GITHUB_KEYS)).all()}
        token = payload.get("github_token") or stored.get("github_token", "")
        repo = payload.get("github_repo") or stored.get("github_repo", "")
        return test_github_connection(token, repo)
    except Exception as e:
        logger.exception("test-github endpoint failed: %s", e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@router.post("/settings/test-rally")
async def test_rally_conn(payload: dict, db: Session = Depends(get_db)):
    """Test Rally API key + workspace + project (+ optional iteration)."""
    try:
        from ..db import Setting as SettingModel

        stored = {
            r.key: r.value
            for r in db.query(SettingModel).filter(SettingModel.key.in_(_RALLY_KEYS)).all()
        }
        api_key = payload.get("rally_api_key") or stored.get("rally_api_key", "")
        workspace = payload.get("rally_workspace") or stored.get("rally_workspace", "")
        project = payload.get("rally_project") or stored.get("rally_project", "")
        iteration = payload.get("rally_iteration") or stored.get("rally_iteration", "")
        return test_rally_connection(api_key, workspace, project, iteration or None)
    except Exception as e:
        logger.exception("test-rally endpoint failed: %s", e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
