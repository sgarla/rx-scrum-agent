"""Claude Code agent runner for the Virtual Scrum Member demo.

Runs claude-agent-sdk in a background thread with a fresh event loop
to avoid subprocess transport issues in FastAPI/uvicorn contexts.

See: https://github.com/anthropics/claude-agent-sdk-python/issues/462
"""

import asyncio
import logging
import os
import threading
from contextvars import copy_context
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Built-in Claude Code tools available to the agent
BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"]

# Working directory for agent file operations (per conversation)
WORK_DIR = os.getenv("WORK_DIR", "./agent_work")

# Databricks auth from environment
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")

# LLM config
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ANTHROPIC")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATABRICKS_MODEL = os.getenv("DATABRICKS_MODEL", "databricks-claude-sonnet-4-5")

# Cached Databricks MCP server and tool names (loaded once at startup)
_mcp_server = None
_tool_names: list[str] = []
_tools_loaded = False


def preload_databricks_tools():
    """Pre-load Databricks MCP tools at server startup."""
    _load_databricks_tools()


def _load_databricks_tools():
    """Load Databricks MCP tools in-process."""
    global _mcp_server, _tool_names, _tools_loaded

    if _tools_loaded:
        return _mcp_server, _tool_names

    try:
        from claude_agent_sdk import create_sdk_mcp_server  # noqa: F401
        from databricks_mcp_server.server import mcp

        try:
            from databricks_mcp_server.tools import sql, compute, file, pipelines  # noqa: F401
        except ImportError:
            pass
        try:
            from databricks_mcp_server.tools import (  # noqa: F401
                dashboards, genie, jobs, ka, serving, vector_search, uc, app, lakebase
            )
        except ImportError:
            pass

        sdk_tools = []
        tool_names = []

        for name, mcp_tool in mcp._tool_manager._tools.items():
            input_schema = _convert_mcp_schema(mcp_tool.parameters)
            wrapped = _make_sdk_wrapper(name, mcp_tool.description, input_schema, mcp_tool.fn)
            sdk_tools.append(wrapped)
            tool_names.append(f"mcp__databricks__{name}")

        server = create_sdk_mcp_server(name="databricks", tools=sdk_tools)
        _mcp_server = server
        _tool_names = tool_names
        _tools_loaded = True
        logger.info(f"Loaded {len(tool_names)} Databricks tools in-process")
        return server, tool_names

    except ImportError as e:
        logger.warning(f"Could not load Databricks tools: {e}. Agent will run without Databricks tools.")
        _tools_loaded = True
        return None, []


def _convert_mcp_schema(params) -> dict:
    if params is None:
        return {"type": "object", "properties": {}}
    if isinstance(params, dict):
        return params
    if hasattr(params, "model_json_schema"):
        return params.model_json_schema()
    if hasattr(params, "schema"):
        return params.schema()
    return {"type": "object", "properties": {}}


def _make_sdk_wrapper(name: str, description: str, input_schema: dict, fn):
    from claude_agent_sdk import tool as sdk_tool

    async def wrapper(**kwargs):
        try:
            if asyncio.iscoroutinefunction(fn):
                result = await fn(**kwargs)
            else:
                result = fn(**kwargs)
            if isinstance(result, list):
                return "\n".join(str(r) for r in result)
            return str(result) if result is not None else ""
        except Exception as e:
            logger.error(f"Tool {name} error: {e}")
            return f"Error in {name}: {e}"

    wrapper.__name__ = name
    wrapped = sdk_tool(
        name=name,
        description=description or f"Databricks tool: {name}",
        input_schema=input_schema,
    )(wrapper)
    return wrapped


def get_agent_work_dir(conversation_id: str) -> Path:
    work_path = Path(WORK_DIR) / conversation_id
    work_path.mkdir(parents=True, exist_ok=True)
    return work_path


def get_fmapi_token() -> str:
    """Get OAuth token from Service Principal credentials.

    Databricks Apps auto-injects DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET,
    and DATABRICKS_HOST. The SDK uses these to generate a fresh OAuth token.
    Same pattern as the AI Dev Kit builder-app.
    """
    from databricks.sdk import WorkspaceClient
    client = WorkspaceClient()
    headers = client.config.authenticate()
    return headers["Authorization"].split(" ")[1]  # Strip "Bearer "


def build_claude_env(host: str, token: str) -> dict:
    env = {}

    if LLM_PROVIDER == "DATABRICKS" and host:
        # If no PAT, fall back to SDK OAuth (works in Databricks Apps with M2M client credentials)
        if not token:
            try:
                token = get_fmapi_token()
                logger.info("Claude subprocess: obtained OAuth token via SDK client credentials")
            except Exception as e:
                logger.warning(f"Could not get SDK OAuth token: {e}")

        if token:
            clean_host = host.replace("https://", "").replace("http://", "").rstrip("/")
            env["ANTHROPIC_BASE_URL"] = f"https://{clean_host}/serving-endpoints/anthropic"
            env["ANTHROPIC_API_KEY"] = token
            env["ANTHROPIC_AUTH_TOKEN"] = token
            env["ANTHROPIC_MODEL"] = DATABRICKS_MODEL
            env["ANTHROPIC_CUSTOM_HEADERS"] = "x-databricks-disable-beta-headers: true"
            logger.info(f"Claude subprocess: using Databricks FMAPI at {clean_host}, model={DATABRICKS_MODEL}")
        else:
            logger.error("LLM_PROVIDER=DATABRICKS but could not obtain a token")
    elif ANTHROPIC_API_KEY:
        env["ANTHROPIC_API_KEY"] = ANTHROPIC_API_KEY
        logger.info("Claude subprocess: using direct ANTHROPIC_API_KEY")
    else:
        logger.error(
            "No LLM auth configured! Claude will fail with 'Invalid API key'. "
            f"LLM_PROVIDER={LLM_PROVIDER}, DATABRICKS_HOST={'set' if host else 'MISSING'}, "
            f"DATABRICKS_TOKEN={'set' if token else 'MISSING'}, "
            f"ANTHROPIC_API_KEY={'set' if ANTHROPIC_API_KEY else 'MISSING'}"
        )

    env["CLAUDE_CODE_STREAM_CLOSE_TIMEOUT"] = os.getenv("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "3600000")
    return env


def start_agent_build(
    story: dict,
    messages: list[dict],
    session_id: str | None,
    conversation_id: str,
    put_event: Callable[[Any], None],
    on_complete: Callable[[], None] | None = None,
    mode: str = 'agent',
) -> threading.Thread:
    """Start the agent in a background thread.

    put_event is called with each SDK event, and with None as the done sentinel.
    Use exec_state.put_event from stream_manager to wire SSE streaming correctly.
    on_complete (optional) is called synchronously after the agent finishes but
    BEFORE the done sentinel — so the DB is ready when the frontend reloads.
    """
    ctx = copy_context()
    thread = threading.Thread(
        target=lambda: ctx.run(
            _run_in_thread,
            story, messages, session_id, conversation_id, put_event, on_complete, mode
        ),
        daemon=True,
        name=f"agent-{conversation_id[:8]}",
    )
    thread.start()
    return thread


def _run_in_thread(story, messages, session_id, conversation_id, put_event, on_complete=None, mode='agent'):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            _run_async(story, messages, session_id, conversation_id, put_event, mode)
        )
        # Save to DB before sending the done sentinel so history is ready on next load
        if on_complete:
            try:
                on_complete()
            except Exception as e:
                logger.exception(f"on_complete callback error: {e}")
    except Exception as e:
        logger.exception(f"Agent thread error: {e}")
    finally:
        put_event(None)  # sentinel: signals completion to SSE stream
        loop.close()


async def _run_async(story, messages, session_id, conversation_id, put_event, mode='agent'):
    from claude_agent_sdk import ClaudeAgentOptions, query
    from .system_prompt import build_story_system_prompt, build_planning_system_prompt

    # Read credentials fresh at call time (not from stale module-level globals)
    host = os.getenv("DATABRICKS_HOST", "") or DATABRICKS_HOST
    token = os.getenv("DATABRICKS_TOKEN", "") or DATABRICKS_TOKEN
    logger.info(f"Agent auth: LLM_PROVIDER={LLM_PROVIDER}, host_set={bool(host)}, token_set={bool(token)}, mode={mode}")
    try:
        from databricks_tools_core.auth import set_databricks_auth
        set_databricks_auth(host, token)
    except ImportError:
        pass

    if mode == 'plan':
        system_prompt = build_planning_system_prompt(story)
        allowed_tools = BUILTIN_TOOLS
        mcp_servers = {}
    else:
        system_prompt = build_story_system_prompt(story)
        mcp_server, tool_names = _load_databricks_tools()
        allowed_tools = BUILTIN_TOOLS + tool_names
        mcp_servers = {"databricks": mcp_server} if mcp_server else {}

    work_dir = get_agent_work_dir(conversation_id)
    claude_env = build_claude_env(host, token)

    def stderr_cb(line: str):
        logger.info(f"[claude stderr] {line.strip()}")

    options = ClaudeAgentOptions(
        cwd=str(work_dir),
        allowed_tools=allowed_tools,
        permission_mode="bypassPermissions",
        resume=session_id,
        mcp_servers=mcp_servers,
        system_prompt=system_prompt,
        setting_sources=["user", "project"],
        env=claude_env,
        include_partial_messages=True,
        stderr=stderr_cb,
    )

    last_message = messages[-1]["content"] if messages else "Please proceed."

    try:
        async for event in query(prompt=last_message, options=options):
            put_event(event)
    except asyncio.CancelledError:
        logger.info("Agent query cancelled")
    except Exception as e:
        logger.exception(f"Agent query error: {e}")
