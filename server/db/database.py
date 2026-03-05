"""PostgreSQL (Lakebase) database setup using SQLAlchemy with Databricks SDK OAuth auth.

Uses the same pattern as builder-app:
- LAKEBASE_INSTANCE_NAME env var for OAuth token generation
- PGHOST / PGPORT / PGDATABASE env vars (set by Databricks Apps resource)
- Dynamic token refresh via threading (tokens expire after ~1 hour)
- Falls back to SQLite if USE_SQLITE=1 or if Lakebase is unavailable
"""

import logging
import os
import threading
import time
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

# Lakebase config — aligned with builder-app env var names
LAKEBASE_INSTANCE_NAME = os.getenv("LAKEBASE_INSTANCE_NAME", "scrum-demo-db")
LAKEBASE_DATABASE_NAME = os.getenv("LAKEBASE_DATABASE_NAME", "databricks_postgres")

# Host: prefer PGHOST (set by Databricks Apps resource), then LAKEBASE_HOST
LAKEBASE_HOST = os.getenv("PGHOST") or os.getenv("LAKEBASE_HOST", "")
LAKEBASE_PORT = int(os.getenv("PGPORT", os.getenv("LAKEBASE_PORT", "5432")))

# Local SQLite fallback
USE_SQLITE = os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes")
SQLITE_PATH = os.getenv("DB_PATH", "./scrum-demo.db")

# Token cache
_token_cache: dict = {"token": None, "expires_at": 0.0}
_token_lock = threading.Lock()


def _get_lakebase_host() -> str:
    """Return Lakebase hostname — from PGHOST, LAKEBASE_HOST, or SDK lookup."""
    if LAKEBASE_HOST:
        return LAKEBASE_HOST
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        instance = w.database.get_database_instance(name=LAKEBASE_INSTANCE_NAME)
        host = instance.read_write_dns
        logger.info(f"Resolved Lakebase host: {host}")
        return host
    except Exception as e:
        raise RuntimeError(
            f"Cannot resolve Lakebase host for instance '{LAKEBASE_INSTANCE_NAME}'. "
            f"Set PGHOST or LAKEBASE_HOST env var. Error: {e}"
        ) from e


def _get_db_token() -> str:
    """Get a fresh OAuth token for Lakebase, caching with 2-minute early refresh."""
    now = time.time()
    with _token_lock:
        if _token_cache["token"] and now < _token_cache["expires_at"] - 120:
            return _token_cache["token"]
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            cred = w.database.generate_database_credential(
                request_id=str(uuid.uuid4()),
                instance_names=[LAKEBASE_INSTANCE_NAME],
            )
            _token_cache["token"] = cred.token
            _token_cache["expires_at"] = now + 3600  # tokens valid ~1 hour
            logger.debug("Refreshed Lakebase OAuth token")
            return cred.token
        except Exception as e:
            logger.error(f"Failed to generate Lakebase credential: {e}")
            raise


def _create_pg_connection():
    """Factory: create a psycopg2 connection with a fresh OAuth token."""
    import psycopg2
    host = _get_lakebase_host()
    token = _get_db_token()
    return psycopg2.connect(
        host=host,
        port=LAKEBASE_PORT,
        dbname=LAKEBASE_DATABASE_NAME,
        user="token",
        password=token,
        sslmode="require",
        connect_timeout=15,
    )


def _build_engine():
    if USE_SQLITE:
        logger.info(f"Using SQLite database at {SQLITE_PATH}")
        return create_engine(
            f"sqlite:///{SQLITE_PATH}",
            connect_args={"check_same_thread": False},
            echo=False,
        )

    logger.info(
        f"Using Lakebase (PostgreSQL) instance='{LAKEBASE_INSTANCE_NAME}' "
        f"db='{LAKEBASE_DATABASE_NAME}'"
    )
    return create_engine(
        "postgresql+psycopg2://",
        creator=_create_pg_connection,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3300,  # Recycle before 1-hour token expiry
        echo=False,
    )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_asset_columns(bind):
    """Add new columns to assets table if they don't exist (safe no-op if already present)."""
    import sqlalchemy
    new_columns = [
        ("catalog", "VARCHAR(255)"),
        ("schema_name", "VARCHAR(255)"),
        ("full_path", "VARCHAR(512)"),
    ]
    with bind.connect() as conn:
        for col, col_type in new_columns:
            try:
                conn.execute(sqlalchemy.text(f"ALTER TABLE assets ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info(f"Migrated: added column assets.{col}")
            except Exception:
                conn.rollback()  # Column already exists — ignore


def init_db():
    """Create all tables. Raises if the database is unavailable."""
    from . import models  # noqa: F401 - ensure models are registered
    Base.metadata.create_all(bind=engine)
    _migrate_asset_columns(engine)
    mode = "SQLite" if USE_SQLITE else f"Lakebase PostgreSQL ({LAKEBASE_INSTANCE_NAME}/{LAKEBASE_DATABASE_NAME})"
    logger.info(f"Database initialized: {mode}")
