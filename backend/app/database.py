from __future__ import annotations

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def normalized_database_url(value: str) -> str:
    """Use psycopg 3 for provider URLs that omit an explicit driver."""
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


DATABASE_URL = normalized_database_url(
    os.getenv("DATABASE_URL", "sqlite:///./neurolearnx.db")
)
PRODUCTION = (
    os.getenv("APP_ENV", "").strip().lower() == "production"
    or os.getenv("REPLIT_DEPLOYMENT") == "1"
)
if PRODUCTION and not DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg://")):
    raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options: dict[str, object] = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
}
if not DATABASE_URL.startswith("sqlite"):
    connect_args.update(
        {
            "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT_SECONDS", "10")),
            "options": (
                "-c statement_timeout="
                f"{int(os.getenv('DB_STATEMENT_TIMEOUT_MS', '30000'))}"
            ),
        }
    )
    engine_options.update(
        {
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "5")),
            "pool_recycle": int(os.getenv("DB_POOL_RECYCLE_SECONDS", "300")),
            "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT_SECONDS", "15")),
        }
    )

engine = create_engine(DATABASE_URL, **engine_options)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
