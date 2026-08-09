"""Add concurrency guards and production query indexes.

Revision ID: 0008_production_hardening
Revises: 0007_learner_onboarding
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_production_hardening"
down_revision = "0007_learner_onboarding"
branch_labels = None
depends_on = None


def index_names(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {item["name"] for item in inspector.get_indexes(table)}


def unique_names(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {
        item["name"]
        for item in inspector.get_unique_constraints(table)
        if item.get("name")
    }


def upgrade() -> None:
    bind = op.get_bind()
    duplicate_attempt = bind.execute(
        sa.text(
            "SELECT student_id, activity_id, started_at, COUNT(*) AS total "
            "FROM assessment_attempts GROUP BY student_id, activity_id, started_at "
            "HAVING COUNT(*) > 1"
        )
    ).first()
    if duplicate_attempt:
        raise RuntimeError(
            "Duplicate assessment submissions must be reviewed before migration 0008"
        )
    duplicate_pathway = bind.execute(
        sa.text(
            "SELECT student_id, COUNT(*) AS total FROM pathway_recommendations "
            "WHERE active = :active AND selected = :selected GROUP BY student_id "
            "HAVING COUNT(*) > 1"
        ),
        {"active": True, "selected": True},
    ).first()
    if duplicate_pathway:
        raise RuntimeError(
            "Competing active selected pathways must be reviewed before migration 0008"
        )

    if "uq_assessment_attempt_submission" not in unique_names("assessment_attempts"):
        with op.batch_alter_table("assessment_attempts") as batch:
            batch.create_unique_constraint(
                "uq_assessment_attempt_submission",
                ["student_id", "activity_id", "started_at"],
            )

    indexes = index_names("assessment_attempts")
    if "ix_assessment_attempts_student_activity_submitted" not in indexes:
        op.create_index(
            "ix_assessment_attempts_student_activity_submitted",
            "assessment_attempts",
            ["student_id", "activity_id", "submitted_at"],
        )
    if "ix_uploaded_documents_owner_status" not in index_names("uploaded_documents"):
        op.create_index(
            "ix_uploaded_documents_owner_status",
            "uploaded_documents",
            ["uploaded_by", "processing_status"],
        )
    if "ix_mastery_records_student_concept_created" not in index_names("mastery_records"):
        op.create_index(
            "ix_mastery_records_student_concept_created",
            "mastery_records",
            ["student_id", "concept_id", "created_at"],
        )
    if "ix_learning_gaps_student_resolved_concept" not in index_names("learning_gaps"):
        op.create_index(
            "ix_learning_gaps_student_resolved_concept",
            "learning_gaps",
            ["student_id", "resolved_at", "concept_id"],
        )
    pathway_indexes = index_names("pathway_recommendations")
    if "uq_pathways_one_active_selected_per_student" not in pathway_indexes:
        op.create_index(
            "uq_pathways_one_active_selected_per_student",
            "pathway_recommendations",
            ["student_id"],
            unique=True,
            postgresql_where=sa.text("selected IS TRUE AND active IS TRUE"),
            sqlite_where=sa.text("selected = 1 AND active = 1"),
        )
    if "ix_pathways_student_active_selected_created" not in pathway_indexes:
        op.create_index(
            "ix_pathways_student_active_selected_created",
            "pathway_recommendations",
            ["student_id", "active", "selected", "created_at"],
        )
    if (
        "ix_cognitive_load_predictions_student_evidence"
        not in index_names("cognitive_load_predictions")
    ):
        op.create_index(
            "ix_cognitive_load_predictions_student_evidence",
            "cognitive_load_predictions",
            ["student_id", "evidence_date"],
        )


def downgrade() -> None:
    for table, name in [
        ("cognitive_load_predictions", "ix_cognitive_load_predictions_student_evidence"),
        ("pathway_recommendations", "ix_pathways_student_active_selected_created"),
        ("pathway_recommendations", "uq_pathways_one_active_selected_per_student"),
        ("learning_gaps", "ix_learning_gaps_student_resolved_concept"),
        ("mastery_records", "ix_mastery_records_student_concept_created"),
        ("uploaded_documents", "ix_uploaded_documents_owner_status"),
        ("assessment_attempts", "ix_assessment_attempts_student_activity_submitted"),
    ]:
        if name in index_names(table):
            op.drop_index(name, table_name=table)
    if "uq_assessment_attempt_submission" in unique_names("assessment_attempts"):
        with op.batch_alter_table("assessment_attempts") as batch:
            batch.drop_constraint("uq_assessment_attempt_submission", type_="unique")
