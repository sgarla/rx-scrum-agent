"""ServiceNow REST API client.

Uses Basic Auth (username + password) against a ServiceNow developer instance.
Connection details are stored in the `settings` DB table.
"""

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ServiceNow settings keys
SNOW_INSTANCE_KEY = "snow_instance"
SNOW_USERNAME_KEY = "snow_username"
SNOW_PASSWORD_KEY = "snow_password"
SNOW_FILTER_KEY = "snow_filter"  # optional encoded query e.g. "active=true^stateNOT IN7,8"

# Default incident filter — excludes Closed and Cancelled
DEFAULT_FILTER = "active=true"

# Map numeric ServiceNow priority/state codes to labels
PRIORITY_LABELS = {
    "1": "Critical",
    "2": "High",
    "3": "Moderate",
    "4": "Low",
    "5": "Planning",
}

STATE_LABELS = {
    "1": "New",
    "2": "In Progress",
    "3": "On Hold",
    "6": "Resolved",
    "7": "Closed",
    "8": "Cancelled",
}

URGENCY_LABELS = {
    "1": "High",
    "2": "Medium",
    "3": "Low",
}


def _get_snow_settings(db) -> dict[str, str]:
    """Load ServiceNow settings from DB. Returns {} if not configured."""
    from ..db import Setting
    keys = [SNOW_INSTANCE_KEY, SNOW_USERNAME_KEY, SNOW_PASSWORD_KEY, SNOW_FILTER_KEY]
    rows = db.query(Setting).filter(Setting.key.in_(keys)).all()
    return {r.key: r.value for r in rows}


def _build_client(settings: dict[str, str]) -> httpx.Client:
    instance = settings.get(SNOW_INSTANCE_KEY, "").strip().rstrip("/")
    username = settings.get(SNOW_USERNAME_KEY, "")
    password = settings.get(SNOW_PASSWORD_KEY, "")
    if not instance or not username or not password:
        raise ValueError("ServiceNow connection not configured. Set instance, username, and password in Settings.")
    # Normalize: strip https:// if present (we'll add it)
    if instance.startswith("https://") or instance.startswith("http://"):
        base_url = instance.split("://", 1)[1]
        base_url = f"https://{base_url}"
    else:
        base_url = f"https://{instance}"
    return httpx.Client(
        base_url=base_url,
        auth=(username, password),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=15.0,
    )


def _display_value(field: Any) -> str:
    """Extract display value from a ServiceNow reference field or plain string."""
    if isinstance(field, dict):
        return field.get("display_value") or field.get("value") or ""
    return str(field) if field else ""


def _normalize_incident(raw: dict) -> dict:
    """Convert raw ServiceNow incident record to our standard shape."""
    number = raw.get("number", "")
    state_code = _display_value(raw.get("state", ""))
    priority_code = _display_value(raw.get("priority", ""))
    urgency_code = _display_value(raw.get("urgency", ""))

    return {
        "sys_id": raw.get("sys_id", ""),
        "number": number,
        "short_description": raw.get("short_description", ""),
        "description": raw.get("description", ""),
        "state": STATE_LABELS.get(state_code, state_code),
        "state_code": state_code,
        "priority": PRIORITY_LABELS.get(priority_code, priority_code),
        "priority_code": priority_code,
        "urgency": URGENCY_LABELS.get(urgency_code, urgency_code),
        "category": raw.get("category", ""),
        "subcategory": raw.get("subcategory", ""),
        "assigned_to": _display_value(raw.get("assigned_to", "")),
        "assignment_group": _display_value(raw.get("assignment_group", "")),
        "cmdb_ci": _display_value(raw.get("cmdb_ci", "")),  # affected CI / service
        "caller_id": _display_value(raw.get("caller_id", "")),
        "opened_at": raw.get("opened_at", ""),
        "resolved_at": raw.get("resolved_at", ""),
        "sys_updated_on": raw.get("sys_updated_on", ""),
        "close_notes": raw.get("close_notes", ""),
        "work_notes": raw.get("work_notes", ""),
        "comments": raw.get("comments", ""),
    }


_INCIDENT_FIELDS = (
    "sys_id,number,short_description,description,state,priority,urgency,"
    "category,subcategory,assigned_to,assignment_group,cmdb_ci,caller_id,"
    "opened_at,resolved_at,sys_updated_on,close_notes,work_notes,comments"
)


def list_incidents(db, limit: int = 50, offset: int = 0, search: str = "") -> dict:
    """Fetch incidents from ServiceNow.

    Returns {"incidents": [...], "total": int, "configured": bool, "error": str|None}
    """
    settings = _get_snow_settings(db)
    if not settings.get(SNOW_INSTANCE_KEY):
        return {"incidents": [], "total": 0, "configured": False, "error": None}

    try:
        client = _build_client(settings)
        base_filter = settings.get(SNOW_FILTER_KEY, DEFAULT_FILTER)

        query_parts = [base_filter] if base_filter else []
        if search:
            # Search in number or short_description
            query_parts.append(
                f"numberLIKE{search}^ORshort_descriptionLIKE{search}"
            )
        encoded_query = "^".join(query_parts) if query_parts else ""

        params: dict[str, Any] = {
            "sysparm_limit": limit,
            "sysparm_offset": offset,
            "sysparm_fields": _INCIDENT_FIELDS,
            "sysparm_display_value": "all",
            "sysparm_order_by_desc": "sys_updated_on",
        }
        if encoded_query:
            params["sysparm_query"] = encoded_query

        resp = client.get("/api/now/table/incident", params=params)
        resp.raise_for_status()
        data = resp.json()
        incidents = [_normalize_incident(r) for r in data.get("result", [])]
        # ServiceNow returns total count in header
        total = int(resp.headers.get("X-Total-Count", len(incidents)))
        return {"incidents": incidents, "total": total, "configured": True, "error": None}

    except ValueError as e:
        return {"incidents": [], "total": 0, "configured": False, "error": str(e)}
    except httpx.HTTPStatusError as e:
        logger.error(f"ServiceNow API error: {e.response.status_code} {e.response.text}")
        return {"incidents": [], "total": 0, "configured": True, "error": f"ServiceNow error: {e.response.status_code}"}
    except Exception as e:
        logger.error(f"ServiceNow request failed: {e}")
        return {"incidents": [], "total": 0, "configured": True, "error": str(e)}


def get_incident(db, number: str) -> dict | None:
    """Fetch a single incident by number (e.g. INC0010001)."""
    settings = _get_snow_settings(db)
    if not settings.get(SNOW_INSTANCE_KEY):
        return None
    try:
        client = _build_client(settings)
        params = {
            "sysparm_query": f"number={number}",
            "sysparm_limit": 1,
            "sysparm_fields": _INCIDENT_FIELDS,
            "sysparm_display_value": "all",
        }
        resp = client.get("/api/now/table/incident", params=params)
        resp.raise_for_status()
        results = resp.json().get("result", [])
        if not results:
            return None
        return _normalize_incident(results[0])
    except Exception as e:
        logger.error(f"ServiceNow get_incident error: {e}")
        return None


def test_connection(instance: str, username: str, password: str) -> dict:
    """Test a ServiceNow connection. Returns {"ok": bool, "error": str|None}."""
    settings = {
        SNOW_INSTANCE_KEY: instance,
        SNOW_USERNAME_KEY: username,
        SNOW_PASSWORD_KEY: password,
    }
    try:
        client = _build_client(settings)
        resp = client.get("/api/now/table/incident", params={"sysparm_limit": 1, "sysparm_fields": "number"})
        resp.raise_for_status()
        return {"ok": True, "error": None}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except httpx.HTTPStatusError as e:
        return {"ok": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
