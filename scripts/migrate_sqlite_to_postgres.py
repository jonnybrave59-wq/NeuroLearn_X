"""Copy a migrated NeuroLearn-X SQLite database into Render PostgreSQL.

The destination URL is read only from DATABASE_URL so credentials do not need
to appear in command history. Run Alembic against both databases first.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, inspect, select, text


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app import models  # noqa: E402,F401
from app.database import Base, normalized_database_url  # noqa: E402


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.resolve().as_posix()}"


def model_artifact(row: dict, source_database: Path) -> bytes | None:
    existing = row.get("artifact")
    if existing:
        return existing
    raw_path = row.get("file_path")
    if not raw_path:
        return None
    path = Path(raw_path)
    if not path.is_absolute():
        path = source_database.parent / path
    if not path.is_file():
        return None
    if path.stat().st_size > 25 * 1024 * 1024:
        raise RuntimeError(f"Refusing to embed oversized model artifact: {path}")
    return path.read_bytes()


def migrate(source_database: Path, replace: bool) -> dict[str, int]:
    if not source_database.is_file():
        raise RuntimeError(f"SQLite source does not exist: {source_database}")
    target_raw = os.getenv("DATABASE_URL", "").strip()
    if not target_raw.startswith(("postgresql://", "postgresql+psycopg://")):
        raise RuntimeError("DATABASE_URL must be the destination PostgreSQL URL")

    source_engine = create_engine(sqlite_url(source_database))
    target_engine = create_engine(
        normalized_database_url(target_raw), pool_pre_ping=True
    )
    tables = list(Base.metadata.sorted_tables)
    target_inspector = inspect(target_engine)
    missing_target = [
        table.name for table in tables if not target_inspector.has_table(table.name)
    ]
    if missing_target:
        raise RuntimeError(
            "Run 'python -m alembic upgrade head' against PostgreSQL first. "
            f"Missing: {', '.join(missing_target)}"
        )

    copied: dict[str, int] = {}
    source_inspector = inspect(source_engine)
    with source_engine.connect() as source, target_engine.begin() as target:
        populated = {
            table.name: target.scalar(select(func.count()).select_from(table)) or 0
            for table in tables
        }
        nonempty = {name: count for name, count in populated.items() if count}
        if nonempty and not replace:
            summary = ", ".join(f"{name}={count}" for name, count in nonempty.items())
            raise RuntimeError(
                "Destination contains NeuroLearn-X records. Re-run with --replace "
                f"only after confirming a backup. Existing rows: {summary}"
            )
        if replace:
            for table in reversed(tables):
                target.execute(table.delete())

        for table in tables:
            if not source_inspector.has_table(table.name):
                copied[table.name] = 0
                continue
            source_column_names = {
                item["name"]
                for item in source_inspector.get_columns(table.name)
            }
            available_columns = [
                column for column in table.columns if column.name in source_column_names
            ]
            rows = [
                dict(row)
                for row in source.execute(
                    select(*available_columns).select_from(table)
                ).mappings()
            ]
            if table.name == "model_versions":
                for row in rows:
                    artifact = model_artifact(row, source_database)
                    if artifact:
                        row["artifact"] = artifact
            for offset in range(0, len(rows), 500):
                target.execute(table.insert(), rows[offset : offset + 500])
            copied[table.name] = len(rows)

        # Explicit primary keys were copied, so align PostgreSQL sequences.
        for table in tables:
            if len(table.primary_key.columns) != 1:
                continue
            primary_key = next(iter(table.primary_key.columns))
            if not getattr(primary_key.type, "python_type", None) is int:
                continue
            sequence = target.scalar(
                text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                {"table_name": table.name, "column_name": primary_key.name},
            )
            if not sequence:
                continue
            maximum = target.scalar(select(func.max(primary_key)))
            target.execute(
                text("SELECT setval(CAST(:sequence AS regclass), :value, :called)"),
                {
                    "sequence": sequence,
                    "value": maximum or 1,
                    "called": maximum is not None,
                },
            )

    source_engine.dispose()
    target_engine.dispose()
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy a migrated NeuroLearn-X SQLite database to PostgreSQL."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=ROOT / "backend" / "neurolearnx.db",
        help="SQLite database path (default: backend/neurolearnx.db)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing NeuroLearn-X rows in the destination before copying",
    )
    args = parser.parse_args()
    copied = migrate(args.source, args.replace)
    print("SQLite to PostgreSQL migration committed:")
    for name, count in copied.items():
        print(f"- {name}: {count}")
    print(f"Total records copied: {sum(copied.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
