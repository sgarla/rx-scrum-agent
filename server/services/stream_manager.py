"""In-memory execution stream manager.

Tracks active agent builds by execution_id. Each execution has a queue
that collects events from the background agent thread. SSE endpoints
drain this queue to stream events to the browser.
"""

import asyncio
import logging
import queue
import threading
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

# execution_id → ExecutionState
_executions: dict[str, "ExecutionState"] = {}
_lock = threading.Lock()

# Max age for completed executions (10 minutes)
_MAX_AGE_SECONDS = 600


class ExecutionState:
    def __init__(self, execution_id: str, conversation_id: str, story_key: str):
        self.execution_id = execution_id
        self.conversation_id = conversation_id
        self.story_key = story_key
        self.event_queue: queue.Queue = queue.Queue()
        self.all_events: list[dict] = []  # full history for reconnect
        self.thread: threading.Thread | None = None
        self.is_done: bool = False
        self.is_cancelled: bool = False
        self.created_at: float = time.time()
        self.completed_at: float | None = None

    def put_event(self, event: Any) -> None:
        if event is None:
            # Sentinel: execution complete
            self.is_done = True
            self.completed_at = time.time()
        self.event_queue.put(event)
        if event is not None:
            self.all_events.append(event)

    def cancel(self) -> None:
        self.is_cancelled = True
        self.is_done = True
        self.completed_at = time.time()
        self.event_queue.put(None)  # unblock any waiting consumer


def create_execution(conversation_id: str, story_key: str) -> str:
    """Create a new execution and return its ID."""
    execution_id = str(uuid.uuid4())
    state = ExecutionState(execution_id, conversation_id, story_key)
    with _lock:
        _executions[execution_id] = state
        _cleanup_old_executions()
    return execution_id


def get_execution(execution_id: str) -> ExecutionState | None:
    with _lock:
        return _executions.get(execution_id)


def set_execution_thread(execution_id: str, thread: threading.Thread) -> None:
    with _lock:
        if execution_id in _executions:
            _executions[execution_id].thread = thread


def get_active_executions() -> list[ExecutionState]:
    """Return all non-done executions."""
    with _lock:
        return [e for e in _executions.values() if not e.is_done]


def get_execution_by_conversation(conversation_id: str) -> ExecutionState | None:
    """Find the most recent execution for a conversation."""
    with _lock:
        matches = [e for e in _executions.values() if e.conversation_id == conversation_id]
        if not matches:
            return None
        return max(matches, key=lambda e: e.created_at)


async def stream_events(execution_id: str, last_event_index: int = 0):
    """Async generator that yields SSE-formatted event strings."""
    state = get_execution(execution_id)
    if state is None:
        yield f"data: {{'type': 'error', 'message': 'Execution not found'}}\n\n"
        return

    # If already cancelled, immediately signal done (don't replay events)
    if state.is_cancelled:
        yield f"data: {{'type': 'done'}}\n\n"
        return

    # Replay past events from last_event_index
    replay = state.all_events[last_event_index:]
    for event in replay:
        yield f"data: {_serialize_event(event)}\n\n"

    # Drain the replayed events from the queue so they are not sent a second time.
    # (all_events and event_queue contain the same events; replaying from all_events
    # would otherwise cause duplicates when the queue loop runs next.)
    for _ in range(len(replay)):
        try:
            state.event_queue.get_nowait()
        except queue.Empty:
            break  # Another consumer already drained these

    if state.is_done:
        yield f"data: {{'type': 'done'}}\n\n"
        return

    # Stream new events from queue
    deadline = time.time() + 50  # 50-second window (avoid 60s HTTP timeout)
    while True:
        if time.time() > deadline:
            # Signal client to reconnect
            event_index = len(state.all_events)
            yield f"data: {{'type': 'reconnect', 'event_index': {event_index}}}\n\n"
            return

        try:
            event = state.event_queue.get(timeout=0.1)
        except queue.Empty:
            if state.is_done:
                yield f"data: {{'type': 'done'}}\n\n"
                return
            # Keepalive
            await asyncio.sleep(0.1)
            continue

        if event is None or state.is_cancelled:
            yield f"data: {{'type': 'done'}}\n\n"
            return

        yield f"data: {_serialize_event(event)}\n\n"
        await asyncio.sleep(0)


def _serialize_event(event: Any) -> str:
    """Convert a claude-agent-sdk event to a JSON string for SSE."""
    import json

    try:
        from claude_agent_sdk.types import (
            AssistantMessage,
            ResultMessage,
            StreamEvent,
            TextBlock,
            ThinkingBlock,
            ToolResultBlock,
            ToolUseBlock,
            UserMessage,
        )

        if isinstance(event, AssistantMessage):
            blocks = []
            for block in event.content:
                if isinstance(block, TextBlock):
                    blocks.append({"type": "text", "text": block.text})
                elif isinstance(block, ThinkingBlock):
                    blocks.append({"type": "thinking", "thinking": block.thinking})
                elif isinstance(block, ToolUseBlock):
                    blocks.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
                elif isinstance(block, ToolResultBlock):
                    content = block.content
                    if hasattr(content, "__iter__") and not isinstance(content, str):
                        content = [
                            {"type": "text", "text": c.text}
                            if hasattr(c, "text") else str(c)
                            for c in content
                        ]
                    blocks.append({
                        "type": "tool_result",
                        "tool_use_id": block.tool_use_id,
                        "content": content,
                        "is_error": getattr(block, "is_error", False),
                    })
            return json.dumps({"type": "assistant_message", "blocks": blocks})

        elif isinstance(event, ResultMessage):
            return json.dumps({
                "type": "result",
                "session_id": getattr(event, "session_id", None),
                "stop_reason": getattr(event, "stop_reason", None),
            })

        elif isinstance(event, UserMessage):
            # Usually synthetic tool results; skip or pass through
            return json.dumps({"type": "user_message"})

        elif hasattr(event, "type"):
            return json.dumps({"type": str(event.type), "data": str(event)})

    except ImportError:
        pass

    # Fallback: serialize as string
    return json.dumps({"type": "raw", "data": str(event)})


def _cleanup_old_executions() -> None:
    """Remove completed executions older than MAX_AGE_SECONDS. Call under _lock."""
    cutoff = time.time() - _MAX_AGE_SECONDS
    to_remove = [
        eid for eid, e in _executions.items()
        if e.is_done and e.completed_at and e.completed_at < cutoff
    ]
    for eid in to_remove:
        del _executions[eid]
