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



# First segments that indicate a non-UC path (Python packages, domain names, etc.)
_NON_UC_CATALOG = {
    'pyspark', 'spark', 'java', 'com', 'org', 'net', 'io', 'apache',
    'cloud', 'aws', 'gcp', 'azure', 'sys', 'os', 're', 'json', 'csv',
    'http', 'https', 'information_schema', 'pg', 'public',
}

# Segments that indicate a Python method chain or library path
_NON_UC_SEGMENT = {
    'write', 'read', 'mode', 'format', 'save', 'load', 'sql', 'types',
    'functions', 'column', 'row', 'session', 'context', 'overwrite',
    'append', 'error', 'ignore', 'option', 'options', 'schema', 'collect',
    'show', 'count', 'filter', 'select', 'join', 'groupby', 'agg',
}


def _extract_assets_fallback(text: str) -> list[dict]:
    """Fallback: extract UC paths and job names from human-readable markdown output."""
    results = []
    seen = set()

    # Match UC table/volume/schema paths like rxcorp.synthetic.members
    uc_pattern = re.compile(r'\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b')
    for m in uc_pattern.finditer(text):
        full_path = m.group(0)
        if full_path in seen:
            continue
        catalog, schema, name = m.group(1), m.group(2), m.group(3)

        # Skip non-UC patterns: Python packages, domain names, method chains
        if catalog in _NON_UC_CATALOG:
            continue
        if any(seg in _NON_UC_SEGMENT for seg in (catalog, schema, name)):
            continue
        # Skip if the segment before this match looks like a Python identifier (df.write.x)
        prefix = text[max(0, m.start()-2):m.start()]
        if prefix.endswith('_.') or (len(prefix) >= 1 and prefix[-1] == '_'):
            continue

        seen.add(full_path)
        # Guess type from context around match
        ctx = text[max(0, m.start()-60):m.end()+60].lower()
        if 'volume' in ctx or 'vol ' in ctx:
            asset_type = 'volume'
        elif 'pipeline' in ctx or 'dlt' in ctx:
            asset_type = 'pipeline'
        elif 'schema' in ctx and 'table' not in ctx:
            asset_type = 'schema'
        else:
            asset_type = 'table'
        results.append({
            "type": asset_type,
            "name": name,
            "url": None,
            "description": full_path,
            "catalog": catalog,
            "schema_name": schema,
            "full_path": full_path,
            "icon": ASSET_ICONS.get(asset_type, "🔗"),
        })

    # Match markdown links that look like job/notebook links: [Job Name](https://...)
    link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
    for m in link_pattern.finditer(text):
        name, url = m.group(1).strip(), m.group(2).strip()
        if name in seen or not name:
            continue
        seen.add(name)
        url_lower = url.lower()
        if 'job' in url_lower or 'job' in name.lower():
            asset_type = 'job'
        elif 'pipeline' in url_lower or 'pipeline' in name.lower():
            asset_type = 'pipeline'
        elif 'dashboard' in url_lower or 'dashboard' in name.lower():
            asset_type = 'dashboard'
        elif 'endpoint' in url_lower or 'serving' in url_lower:
            asset_type = 'endpoint'
        elif 'notebook' in url_lower:
            asset_type = 'notebook'
        else:
            asset_type = 'job'
        results.append({
            "type": asset_type,
            "name": name,
            "url": url,
            "description": None,
            "catalog": None,
            "schema_name": None,
            "full_path": None,
            "icon": ASSET_ICONS.get(asset_type, "🔗"),
        })

    return results


def extract_assets(text: str) -> list[dict]:
    """Extract asset list from agent output containing an <assets_summary> block.

    Falls back to parsing human-readable markdown if no XML block is present.
    Returns a list of asset dicts with keys: type, name, url, description.
    """
    # Match <assets_summary>...</assets_summary>
    pattern = re.compile(
        r"<assets_summary>\s*(.*?)\s*</assets_summary>",
        re.DOTALL | re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        logger.info("No <assets_summary> block found — using markdown fallback parser")
        return _extract_assets_fallback(text)

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
