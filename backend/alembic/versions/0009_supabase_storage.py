"""Track persistent Supabase Storage objects for uploaded documents.

Revision ID: 0009_supabase_storage
Revises: 0008_production_hardening
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_supabase_storage"
down_revision = "0008_production_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_columns("uploaded_documents")
    }
    if "storage_bucket" not in columns:
        op.add_column(
            "uploaded_documents",
            sa.Column("storage_bucket", sa.String(length=120), nullable=True),
        )
    if "storage_object_path" not in columns:
        op.add_column(
            "uploaded_documents",
            sa.Column("storage_object_path", sa.String(length=700), nullable=True),
        )


def downgrade() -> None:
    columns = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_columns("uploaded_documents")
    }
    with op.batch_alter_table("uploaded_documents") as batch:
        if "storage_object_path" in columns:
            batch.drop_column("storage_object_path")
        if "storage_bucket" in columns:
            batch.drop_column("storage_bucket")
