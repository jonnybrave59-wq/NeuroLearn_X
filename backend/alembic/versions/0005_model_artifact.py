"""Persist trained model artifacts in the database.

Revision ID: 0005_model_artifact
Revises: 0004_intelligent_tutoring
Create Date: 2026-08-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_model_artifact"
down_revision = "0004_intelligent_tutoring"
branch_labels = None
depends_on = None


def has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table) and column in {
        item["name"] for item in inspector.get_columns(table)
    }


def upgrade() -> None:
    if not has_column("model_versions", "artifact"):
        with op.batch_alter_table("model_versions") as batch:
            batch.add_column(sa.Column("artifact", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    if has_column("model_versions", "artifact"):
        with op.batch_alter_table("model_versions") as batch:
            batch.drop_column("artifact")
