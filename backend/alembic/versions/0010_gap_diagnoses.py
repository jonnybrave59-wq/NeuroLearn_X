"""Store learner-owned explainable knowledge-gap diagnoses.

Revision ID: 0010_gap_diagnoses
Revises: 0009_supabase_storage
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_gap_diagnoses"
down_revision = "0009_supabase_storage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "gap_diagnoses" in inspector.get_table_names():
        return
    op.create_table(
        "gap_diagnoses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("concept_id", sa.Integer(), sa.ForeignKey("concepts.id"), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("diagnosis", sa.JSON(), nullable=False),
        sa.Column("evidence_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=True),
        sa.Column("recommended_activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=True),
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_gap_diagnoses_student_id", "gap_diagnoses", ["student_id"])
    op.create_index("ix_gap_diagnoses_concept_id", "gap_diagnoses", ["concept_id"])
    op.create_index("ix_gap_diagnoses_status", "gap_diagnoses", ["status"])
    op.create_index("ix_gap_diagnoses_is_demo", "gap_diagnoses", ["is_demo"])
    op.create_index(
        "ix_gap_diagnoses_student_concept_created",
        "gap_diagnoses",
        ["student_id", "concept_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("gap_diagnoses")
