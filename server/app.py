"""FastAPI application for the Virtual Scrum Member demo."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .db import init_db
from .routers import stories_router, agent_router, assets_router, genie_router, settings_router, incidents_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

API_PREFIX = "/api"
CLIENT_DIST = Path(__file__).parent.parent / "client" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    try:
        init_db()
    except Exception as e:
        logger.error(f"DATABASE INIT FAILED — {type(e).__name__}: {e}", exc_info=True)
        raise

    # Ensure agent work directory exists
    work_dir = Path(os.getenv("WORK_DIR", "./agent_work"))
    work_dir.mkdir(parents=True, exist_ok=True)

    # Pre-load Databricks tools at startup (avoids cold start on first build)
    try:
        from .services.agent import _load_databricks_tools
        server, tools = _load_databricks_tools()
        logger.info(f"Pre-loaded {len(tools)} Databricks tools")
    except Exception as e:
        logger.warning(f"Could not pre-load Databricks tools: {e}")

    logger.info("Virtual Scrum Member demo ready.")
    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="Virtual Scrum Member",
    description="JIRA + Databricks SDLC Accelerator Demo",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(stories_router, prefix=API_PREFIX, tags=["stories"])
app.include_router(agent_router, prefix=API_PREFIX, tags=["agent"])
app.include_router(assets_router, prefix=API_PREFIX, tags=["assets"])
app.include_router(genie_router, prefix=API_PREFIX, tags=["genie"])
app.include_router(settings_router, prefix=API_PREFIX, tags=["settings"])
app.include_router(incidents_router, prefix=API_PREFIX, tags=["incidents"])


@app.get("/api/health")
async def health():
    from .stories.healthcare import STORIES
    host = os.getenv("DATABRICKS_HOST", "")
    token = os.getenv("DATABRICKS_TOKEN", "")
    return {
        "status": "ok",
        "stories": len(STORIES),
        "workspace_url": host or "not configured",
        "databricks_configured": bool(host and token),
    }


# Serve React frontend (built assets)
if CLIENT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(CLIENT_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        file_path = CLIENT_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(CLIENT_DIST / "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "message": "Virtual Scrum Member API",
            "note": "Build the React frontend with: cd client && npm run build",
            "docs": "/docs",
        }
