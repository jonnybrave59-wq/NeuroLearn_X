"""Persist question provenance, model metadata, and cognitive-load predictions.

Revision ID: 0006_teacher_refinement_evidence
Revises: 0005_model_artifact
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_teacher_refinement_evidence"
down_revision = "0005_model_artifact"
branch_labels = None
depends_on = None


def has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table) and column in {
        item["name"] for item in inspector.get_columns(table)
    }


def upgrade() -> None:
    if not has_column("questions", "generation_metadata"):
        with op.batch_alter_table("questions") as batch:
            batch.add_column(sa.Column("generation_metadata", sa.JSON(), nullable=True))
    if not has_column("model_versions", "metadata_json"):
        with op.batch_alter_table("model_versions") as batch:
            batch.add_column(sa.Column("metadata_json", sa.JSON(), nullable=True))
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("cognitive_load_predictions"):
        op.create_table(
            "cognitive_load_predictions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=False),
            sa.Column("evidence_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("probabilities", sa.JSON(), nullable=False),
            sa.Column("predicted_category", sa.String(length=20), nullable=False),
            sa.Column("expected_index", sa.Float(), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False),
            sa.Column("evidence", sa.JSON(), nullable=False),
            sa.Column("missing_features", sa.JSON(), nullable=False),
            sa.Column("feature_contributions", sa.JSON(), nullable=False),
            sa.Column("recommended_action", sa.Text(), nullable=False),
            sa.Column("is_demo", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_cognitive_load_predictions_student_id", "cognitive_load_predictions", ["student_id"])
        op.create_index("ix_cognitive_load_predictions_model_version_id", "cognitive_load_predictions", ["model_version_id"])
        op.create_index("ix_cognitive_load_predictions_evidence_date", "cognitive_load_predictions", ["evidence_date"])
        op.create_index("ix_cognitive_load_predictions_predicted_category", "cognitive_load_predictions", ["predicted_category"])
        op.create_index("ix_cognitive_load_predictions_is_demo", "cognitive_load_predictions", ["is_demo"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("cognitive_load_predictions"):
        op.drop_table("cognitive_load_predictions")
    if has_column("model_versions", "metadata_json"):
        with op.batch_alter_table("model_versions") as batch:
            batch.drop_column("metadata_json")
    if has_column("questions", "generation_metadata"):
        with op.batch_alter_table("questions") as batch:
            batch.drop_column("generation_metadata")
