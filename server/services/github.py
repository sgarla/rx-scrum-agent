"""GitHub REST API client for listing and reading issues."""
import logging
import re
from typing import Any
import httpx
logger = logging.getLogger(__name__)
GITHUB_TOKEN_KEY = "github_token"
GITHUB_REPO_KEY = "github_repo"
GITHUB_API = "https://api.github.com"
def _get_github_settings(db):
    from ..db import Setting
    keys = [GITHUB_TOKEN_KEY, GITHUB_REPO_KEY]
    rows = db.query(Setting).filter(Setting.key.in_(keys)).all()
    return {r.key: r.value for r in rows}
def _parse_repo(repo: str):
    repo = repo.strip()
    if not repo or "/" not in repo:
        return None
    parts = repo.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0].strip(), parts[1].strip()
def is_github_configured(db) -> bool:
    s = _get_github_settings(db)
    return bool(s.get(GITHUB_TOKEN_KEY, "").strip() and _parse_repo(s.get(GITHUB_REPO_KEY, "")))
def test_github_connection(token: str, repo: str) -> dict[str, Any]:
    token = (token or "").strip()
    parsed = _parse_repo(repo)
    if not token:
        return {"ok": False, "error": "GitHub token is required"}
    if not parsed:
        return {"ok": False, "error": "Repository must be owner/repo (e.g. org/repo)"}
    owner, name = parsed
    headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(f"{GITHUB_API}/user", headers=headers)
            if r.status_code == 401:
                return {"ok": False, "error": "Invalid or expired GitHub token"}
            r.raise_for_status()
            repo_r = client.get(f"{GITHUB_API}/repos/{owner}/{name}", headers=headers)
            if repo_r.status_code == 404:
                return {"ok": False, "error": f"Repository not found or no access: {owner}/{name}"}
            repo_r.raise_for_status()
            data = repo_r.json()
            return {"ok": True, "error": None, "full_name": data.get("full_name", f"{owner}/{name}")}
    except Exception as e:
        logger.warning("GitHub test error: %s: %s", type(e).__name__, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
def _normalize_issue(raw: dict, owner: str, repo_name: str) -> dict:
    num = raw.get("number") or 0
    key = f"gh:{owner}/{repo_name}#{num}"
    labels = []
    for lb in raw.get("labels") or []:
        labels.append(lb.get("name", "") if isinstance(lb, dict) else str(lb))
    user = raw.get("user") or {}
    assignee = raw.get("assignee") or {}
    return {"key": key, "number": int(num), "title": raw.get("title") or "", "body": raw.get("body") or "", "state": raw.get("state") or "open", "html_url": raw.get("html_url") or "", "labels": [x for x in labels if x], "user_login": user.get("login") if isinstance(user, dict) else "", "assignee_login": assignee.get("login") if isinstance(assignee, dict) else "", "created_at": raw.get("created_at") or "", "updated_at": raw.get("updated_at") or ""}
def list_issues(db, *, state: str = "open", search: str = "", limit: int = 50, page: int = 1) -> dict:
    settings = _get_github_settings(db)
    token = settings.get(GITHUB_TOKEN_KEY, "").strip()
    parsed = _parse_repo(settings.get(GITHUB_REPO_KEY, ""))
    if not token or not parsed:
        return {"issues": [], "total": 0, "configured": False, "error": "GitHub is not configured. Add a token and repository in Settings."}
    owner, repo_name = parsed
    headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}
    params = {"state": state if state in ("open", "closed", "all") else "open", "per_page": min(max(limit, 1), 100), "page": max(page, 1)}
    if search.strip():
        q = f"repo:{owner}/{repo_name} is:issue {search.strip()}"
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.get(f"{GITHUB_API}/search/issues", headers=headers, params={"q": q, "per_page": params["per_page"], "page": params["page"]})
                if r.status_code == 401:
                    return {"issues": [], "total": 0, "configured": True, "error": "Invalid GitHub token"}
                r.raise_for_status()
                data = r.json()
                out = []
                for item in data.get("items") or []:
                    if item.get("pull_request"):
                        continue
                    out.append(_normalize_issue(item, owner, repo_name))
                return {"issues": out, "total": data.get("total_count", len(out)), "configured": True, "error": None}
        except Exception as e:
            logger.exception("GitHub search failed: %s: %s", type(e).__name__, e)
            return {"issues": [], "total": 0, "configured": True, "error": f"{type(e).__name__}: {e}"}
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(f"{GITHUB_API}/repos/{owner}/{repo_name}/issues", headers=headers, params=params)
            if r.status_code == 401:
                return {"issues": [], "total": 0, "configured": True, "error": "Invalid GitHub token"}
            if r.status_code == 404:
                return {"issues": [], "total": 0, "configured": True, "error": f"Repository not found: {owner}/{repo_name}"}
            r.raise_for_status()
            raw_list = r.json()
    except Exception as e:
        logger.exception("GitHub list issues failed: %s: %s", type(e).__name__, e)
        return {"issues": [], "total": 0, "configured": True, "error": f"{type(e).__name__}: {e}"}
    out = []
    for raw in raw_list:
        if raw.get("pull_request"):
            continue
        issue = _normalize_issue(raw, owner, repo_name)
        if search.strip():
            s = search.lower()
            if s not in (issue["title"] + issue["body"]).lower() and s not in str(issue["number"]):
                continue
        out.append(issue)
    return {"issues": out, "total": len(out), "configured": True, "error": None}
def get_issue_by_key(db, story_key: str):
    m = re.match(r"^gh:([^/]+)/([^#]+)#(\d+)$", str(story_key).strip())
    if not m:
        return None
    owner, repo_name, num_s = m.group(1), m.group(2), m.group(3)
    issue_num = int(num_s)
    settings = _get_github_settings(db)
    token = settings.get(GITHUB_TOKEN_KEY, "").strip()
    if not token:
        return None
    headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(f"{GITHUB_API}/repos/{owner}/{repo_name}/issues/{issue_num}", headers=headers)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            raw = r.json()
            if raw.get("pull_request"):
                return None
            return _normalize_issue(raw, owner, repo_name)
    except httpx.HTTPError as e:
        logger.warning("get_issue_by_key failed: %s", e)
        return None
def parse_github_story_key(story_key: str):
    m = re.match(r"^gh:([^/]+)/([^#]+)#(\d+)$", str(story_key).strip())
    if not m:
        return None
    return m.group(1), m.group(2), int(m.group(3))
