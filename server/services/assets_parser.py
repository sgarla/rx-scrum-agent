"""Parse Databricks asset summaries from agent output.

The agent is instructed to output an <assets_summary> JSON block when complete.
This module extracts and validates those assets for storage and display.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)

# Asset type → display icon
ASSET_ICONS = {
    "pipeline": "🔄",
    "table": "📋",
    "dashboard": "📊",
    "endpoint": "🤖",
    "job": "⏰",
    "schema": "🗄️",
    "notebook": "📓",
    "volume": "📦",
    "model": "🧠",
    "index": "🔍",
}

VALID_ASSET_TYPES = set(ASSET_ICONS.keys())


def extract_assets(text: str) -> list[dict]:
    """Extract asset list from agent output containing an <assets_summary> block.

    Returns a list of asset dicts with keys: type, name, url, description.
    Returns [] if no valid assets_summary found.
    """
    # Match <assets_summary>...</assets_summary>
    pattern = re.compile(
        r"<assets_summary>\s*(.*?)\s*</assets_summary>",
        re.DOTALL | re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return []

    raw_json = match.group(1).strip()
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        # Try to extract just the JSON object if there's extra content
        # Find the first { and last }
        start = raw_json.find("{")
        end = raw_json.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(raw_json[start:end])
            except json.JSONDecodeError:
                logger.warning("Failed to parse assets_summary JSON: %s", raw_json[:200])
                return []
        else:
            return []

    assets = data.get("assets", [])
    if not isinstance(assets, list):
        return []

    result = []
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        asset_type = str(asset.get("type", "")).lower().strip()
        name = str(asset.get("name", "")).strip()
        url = str(asset.get("url", "")).strip() or None
        description = str(asset.get("description", "")).strip() or None
        catalog = str(asset.get("catalog", "")).strip() or None
        schema_name = str(asset.get("schema", "")).strip() or None
        full_path = str(asset.get("full_path", "")).strip() or None

        # Derive full_path from name if it looks like a 3-part UC path
        if not full_path and name and name.count(".") == 2:
            full_path = name
        # Derive catalog/schema from full_path if not explicitly set
        if full_path and not catalog:
            parts = full_path.split(".")
            catalog = parts[0] if len(parts) >= 1 else None
            schema_name = schema_name or (parts[1] if len(parts) >= 2 else None)

        if not name:
            continue

        # Normalize asset type
        if asset_type not in VALID_ASSET_TYPES:
            # Try to guess from name
            if "pipeline" in asset_type:
                asset_type = "pipeline"
            elif "table" in asset_type or "." in name:
                asset_type = "table"
            elif "dashboard" in asset_type:
                asset_type = "dashboard"
            elif "endpoint" in asset_type or "serving" in asset_type:
                asset_type = "endpoint"
            elif "job" in asset_type:
                asset_type = "job"
            elif "schema" in asset_type:
                asset_type = "schema"
            elif "notebook" in asset_type:
                asset_type = "notebook"
            elif "volume" in asset_type:
                asset_type = "volume"
            elif "index" in asset_type or "vector" in asset_type:
                asset_type = "index"
            else:
                asset_type = "table"  # default fallback

        # Sanitize URL
        if url and not (url.startswith("http://") or url.startswith("https://")):
            url = None

        result.append({
            "type": asset_type,
            "name": name,
            "url": url,
            "description": description,
            "catalog": catalog,
            "schema_name": schema_name,
            "full_path": full_path,
            "icon": ASSET_ICONS.get(asset_type, "🔗"),
        })

    return result


def get_asset_label(asset_type: str) -> str:
    """Human-readable label for an asset type."""
    labels = {
        "pipeline": "DLT Pipeline",
        "table": "Delta Table",
        "dashboard": "AI/BI Dashboard",
        "endpoint": "Model Endpoint",
        "job": "Databricks Job",
        "schema": "UC Schema",
        "notebook": "Notebook",
        "volume": "UC Volume",
        "model": "Registered Model",
        "index": "Vector Search Index",
    }
    return labels.get(asset_type, asset_type.title())
