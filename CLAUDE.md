# RxCorp Bricks Agent

AI-powered scrum board where users select JIRA stories and build them end-to-end
using a Claude Code agent with Databricks MCP tools.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (dark theme, CSS variables)
- **Backend**: FastAPI (Python), served via Databricks Apps compute
- **AI**: Anthropic Claude via claude-agent-sdk, streamed over SSE to the browser
- **Storage**: Lakebase PostgreSQL (`scrum-demo-db` instance, `databricks_postgres` DB) — conversations, messages, assets; set `USE_SQLITE=1` for local dev without Databricks credentials
- **Deployed to**: Databricks Apps — app name `rxscrum-agent`, profile `builder-demo`

## Directory Structure

```
├── app.yaml              # Databricks Apps runtime config (env vars)
├── requirements.txt      # Python dependencies
├── deploy.sh             # Build + stage + deploy script (DO NOT use databricks sync)
├── client/               # React frontend (Vite)
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── ChatPanel/       # Main chat UI (AgentMessage, ChatInput, ToolUseCard)
│       │   ├── StoryPanel/      # JIRA story list + filters
│       │   ├── AssetsPanel/     # Databricks assets created by the agent
│       │   └── GeniePanel/      # Genie conversational analytics tab
│       ├── hooks/
│       │   ├── useConversation.ts   # SSE streaming, build/chat lifecycle
│       │   ├── useStories.ts
│       │   └── useAssets.ts
│       └── lib/
│           ├── api.ts            # All /api/* fetch calls
│           └── types.ts
└── server/
    ├── app.py                # FastAPI app entrypoint
    ├── db/                   # SQLAlchemy models + session
    ├── routers/
    │   ├── agent.py          # POST /api/agent/invoke, GET /api/agent/stream/{id}
    │   ├── assets.py
    │   ├── conversations.py
    │   └── genie.py
    ├── services/
    │   ├── agent.py          # Claude agent invocation (claude-agent-sdk)
    │   ├── system_prompt.py  # build_system_prompt(story), build_planning_system_prompt(story)
    │   ├── stream_manager.py # In-memory execution_id → SSE queue registry
    │   └── assets_parser.py
    └── stories/
        └── healthcare.py     # Mock JIRA story data for RxCorp demo
```

## Local Development

```bash
# Terminal 1 — Backend
cd server
pip install -r ../requirements.txt
uvicorn app:app --reload --port 8000

# Terminal 2 — Frontend
cd client
npm install
npm run dev
# Vite proxies /api/* → localhost:8000
```

## Deployment

```bash
./deploy.sh
```

This script:
1. Builds the React frontend (`npm run build`)
2. Stages clean files to `/tmp/rxscrum-stage` (no `.venv`, `node_modules`, `*.db`, `agent_work`)
3. Uploads to Databricks workspace via `workspace import-dir`
4. Runs `apps deploy rxscrum-agent`
5. Polls until SUCCEEDED or FAILED

**NEVER use `databricks sync`** — it's a daemon process that never exits and uploads `.venv`.
Always deploy via `workspace import-dir` from the clean staging directory.

## Key Conventions

- **Theming**: CSS variables only — `var(--color-accent)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-text-primary/secondary/muted)`, `var(--color-done)`. Never hardcode colors.
- **SSE streaming**: `stream_manager.py` maps live `execution_id → asyncio.Queue`. `fetchConversationStatus()` returns `execution_id` only when an execution is live — use this to reconnect SSE on page reload.
- **Conversation loading**: `conversationLoading` boolean covers the 3-call chain: `fetchConversationsByStory` → `fetchConversationFull` → `fetchConversationStatus`. Show spinner until all three complete.
- **Chat timestamps**: Compare `msg.timestamp.toDateString()` vs prev message to show date separator pills ("Today", "Yesterday", or formatted date). Show per-message times via the `showTime` prop on `AgentMessage`.

## In-Progress Features

- **Plan Mode / Agent Mode toggle**: UI toggle in chat input bar. Plan = conversational advisory only (no Databricks tools). Agent = current behavior (full MCP tools + Claude Code agent). Backend branches on `mode: 'plan' | 'agent'` field in `InvokeAgentRequest`.
