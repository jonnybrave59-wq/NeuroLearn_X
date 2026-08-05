"""Add explainable intelligent-tutoring evidence and history.

Revision ID: 0004_intelligent_tutoring
Revises: 0003_adaptive_learning
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_intelligent_tutoring"
down_revision = "0003_adaptive_learning"
branch_labels = None
depends_on = None

SQLITE_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def has_column(table: str, column: str) -> bool:
    return has_table(table) and column in {
        item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)
    }


def upgrade() -> None:
    if not has_table("misconceptions"):
        op.create_table(
            "misconceptions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("name", sa.String(180), nullable=False),
            sa.Column("concept_id", sa.Integer(), sa.ForeignKey("concepts.id"), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=False),
            sa.Column("remediation_instruction", sa.Text(), nullable=False),
            sa.Column("suggested_activity_id", sa.Integer(), sa.ForeignKey("activities.id")),
            sa.Column("validation_status", sa.String(30), nullable=False, server_default="Teacher reviewed"),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_misconceptions_code", "misconceptions", ["code"], unique=True)
        op.create_index("ix_misconceptions_concept_id", "misconceptions", ["concept_id"])
        op.create_index("ix_misconceptions_validation_status", "misconceptions", ["validation_status"])
        op.create_index("ix_misconceptions_active", "misconceptions", ["active"])

    if not has_column("questions", "solution_structure"):
        with op.batch_alter_table("questions", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.add_column(sa.Column("solution_structure", sa.JSON(), nullable=False, server_default="{}"))
            batch.add_column(sa.Column("estimated_cognitive_demand", sa.Float(), nullable=False, server_default="0.5"))
            batch.add_column(sa.Column("prerequisite_concept_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(
                "fk_questions_prerequisite_concept_id_concepts",
                "concepts",
                ["prerequisite_concept_id"],
                ["id"],
            )

    if not has_column("answer_choices", "misconception_id"):
        with op.batch_alter_table("answer_choices", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.add_column(sa.Column("misconception_id", sa.Integer(), nullable=True))
            batch.add_column(sa.Column("misconception_confidence", sa.Float(), nullable=True))
            batch.add_column(sa.Column("mapping_status", sa.String(30), nullable=False, server_default="Unreviewed"))
            batch.create_foreign_key(
                "fk_answer_choices_misconception_id_misconceptions",
                "misconceptions",
                ["misconception_id"],
                ["id"],
            )
            batch.create_index("ix_answer_choices_misconception_id", ["misconception_id"])
            batch.create_index("ix_answer_choices_mapping_status", ["mapping_status"])

    if not has_column("pathway_recommendations", "decision_explanation"):
        with op.batch_alter_table("pathway_recommendations", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.add_column(sa.Column("decision_explanation", sa.JSON(), nullable=False, server_default="{}"))
            batch.add_column(sa.Column("evidence_confidence", sa.String(20), nullable=False, server_default="Low"))
            batch.create_index("ix_pathway_recommendations_evidence_confidence", ["evidence_confidence"])

    if not has_table("tutoring_sessions"):
        op.create_table(
            "tutoring_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=False),
            sa.Column("concept_id", sa.Integer(), sa.ForeignKey("concepts.id"), nullable=False),
            sa.Column("mode", sa.String(30), nullable=False, server_default="guided"),
            sa.Column("status", sa.String(30), nullable=False, server_default="Active"),
            sa.Column("current_difficulty", sa.String(20), nullable=False, server_default="Moderate"),
            sa.Column("scaffolding_level", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("responses_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("consecutive_correct", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("mastery_before", sa.Float()),
            sa.Column("mastery_after", sa.Float()),
            sa.Column("stop_reason", sa.String(120)),
            sa.Column("attempt_id", sa.Integer(), sa.ForeignKey("assessment_attempts.id")),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("student_id", "activity_id", "concept_id", "mode", "status"):
            op.create_index(f"ix_tutoring_sessions_{column}", "tutoring_sessions", [column])

    if not has_table("tutoring_responses"):
        op.create_table(
            "tutoring_responses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("tutoring_sessions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id"), nullable=False),
            sa.Column("selected_choice_id", sa.Integer(), sa.ForeignKey("answer_choices.id")),
            sa.Column("response_text", sa.Text()),
            sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("response_seconds", sa.Float(), nullable=False, server_default="0"),
            sa.Column("hint_opened", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("answer_changes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("difficulty_at_response", sa.String(20), nullable=False, server_default="Moderate"),
            sa.Column("scaffolding_level", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("misconception_id", sa.Integer(), sa.ForeignKey("misconceptions.id")),
            sa.Column("sequence", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("session_id", "question_id"),
        )
        for column in ("session_id", "question_id", "misconception_id"):
            op.create_index(f"ix_tutoring_responses_{column}", "tutoring_responses", [column])

    if not has_table("misconception_history"):
        op.create_table(
            "misconception_history",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("misconception_id", sa.Integer(), sa.ForeignKey("misconceptions.id"), nullable=False),
            sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id"), nullable=False),
            sa.Column("selected_choice_id", sa.Integer(), sa.ForeignKey("answer_choices.id")),
            sa.Column("attempt_id", sa.Integer(), sa.ForeignKey("assessment_attempts.id")),
            sa.Column("tutoring_session_id", sa.Integer(), sa.ForeignKey("tutoring_sessions.id")),
            sa.Column("evidence_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("confidence_level", sa.String(20), nullable=False, server_default="Low"),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
            sa.Column("resolved_by_attempt_id", sa.Integer(), sa.ForeignKey("assessment_attempts.id")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("student_id", "misconception_id"):
            op.create_index(f"ix_misconception_history_{column}", "misconception_history", [column])

    if not has_table("pathway_versions"):
        op.create_table(
            "pathway_versions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("pathway_id", sa.Integer(), sa.ForeignKey("pathway_recommendations.id"), nullable=False),
            sa.Column("previous_pathway_id", sa.Integer(), sa.ForeignKey("pathway_recommendations.id")),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("trigger_type", sa.String(40), nullable=False),
            sa.Column("trigger_id", sa.Integer()),
            sa.Column("change_reason", sa.Text(), nullable=False),
            sa.Column("previous_state", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("updated_state", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("student_id", "pathway_id", "trigger_type"):
            op.create_index(f"ix_pathway_versions_{column}", "pathway_versions", [column])

    if not has_table("learning_summaries"):
        op.create_table(
            "learning_summaries",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id"), nullable=False),
            sa.Column("attempt_id", sa.Integer(), sa.ForeignKey("assessment_attempts.id"), unique=True),
            sa.Column("tutoring_session_id", sa.Integer(), sa.ForeignKey("tutoring_sessions.id"), unique=True),
            sa.Column("summary", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("student_id", "activity_id", "attempt_id"):
            op.create_index(f"ix_learning_summaries_{column}", "learning_summaries", [column])

    if not has_table("teacher_interventions"):
        op.create_table(
            "teacher_interventions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("concept_id", sa.Integer(), sa.ForeignKey("concepts.id")),
            sa.Column("misconception_id", sa.Integer(), sa.ForeignKey("misconceptions.id")),
            sa.Column("pathway_id", sa.Integer(), sa.ForeignKey("pathway_recommendations.id")),
            sa.Column("assigned_activity_id", sa.Integer(), sa.ForeignKey("activities.id")),
            sa.Column("action_type", sa.String(50), nullable=False),
            sa.Column("note", sa.Text(), nullable=False, server_default=""),
            sa.Column("status", sa.String(30), nullable=False, server_default="Open"),
            sa.Column("resolved_at", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        for column in ("teacher_id", "student_id", "action_type", "status"):
            op.create_index(f"ix_teacher_interventions_{column}", "teacher_interventions", [column])


def downgrade() -> None:
    for table in (
        "teacher_interventions",
        "learning_summaries",
        "pathway_versions",
        "misconception_history",
        "tutoring_responses",
        "tutoring_sessions",
    ):
        if has_table(table):
            op.drop_table(table)
    if has_column("pathway_recommendations", "decision_explanation"):
        with op.batch_alter_table("pathway_recommendations", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.drop_index("ix_pathway_recommendations_evidence_confidence")
            batch.drop_column("evidence_confidence")
            batch.drop_column("decision_explanation")
    if has_column("answer_choices", "misconception_id"):
        with op.batch_alter_table("answer_choices", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.drop_index("ix_answer_choices_mapping_status")
            batch.drop_index("ix_answer_choices_misconception_id")
            batch.drop_column("mapping_status")
            batch.drop_column("misconception_confidence")
            batch.drop_column("misconception_id")
    if has_column("questions", "solution_structure"):
        with op.batch_alter_table("questions", naming_convention=SQLITE_NAMING_CONVENTION) as batch:
            batch.drop_column("prerequisite_concept_id")
            batch.drop_column("estimated_cognitive_demand")
            batch.drop_column("solution_structure")
    if has_table("misconceptions"):
        op.drop_table("misconceptions")
