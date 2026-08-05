"""Add evidence-based pathways and document-analysis metadata.

Revision ID: 0003_adaptive_learning
Revises: 0002_accounts_authoring
Create Date: 2026-07-31
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_adaptive_learning"
down_revision = "0002_accounts_authoring"
branch_labels = None
depends_on = None

SQLITE_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def has_column(table: str, column: str) -> bool:
    return column in {
        item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)
    }


def upgrade() -> None:
    # 0001 creates current metadata on a new installation, so only alter older DBs.
    if not has_column("uploaded_documents", "analysis"):
        with op.batch_alter_table("uploaded_documents") as batch:
            batch.add_column(
                sa.Column("analysis", sa.JSON(), nullable=False, server_default="{}")
            )

    if not has_column("questions", "source_locator"):
        with op.batch_alter_table(
            "questions", naming_convention=SQLITE_NAMING_CONVENTION
        ) as batch:
            batch.add_column(
                sa.Column(
                    "source_locator",
                    sa.String(length=300),
                    nullable=False,
                    server_default="Uploaded learning material",
                )
            )
            batch.add_column(
                sa.Column("solution_steps", sa.Text(), nullable=False, server_default="")
            )
            batch.add_column(
                sa.Column(
                    "validation_status",
                    sa.String(length=30),
                    nullable=False,
                    server_default="Needs review",
                )
            )
            batch.add_column(
                sa.Column(
                    "validation_flags", sa.JSON(), nullable=False, server_default="[]"
                )
            )
            batch.add_column(
                sa.Column(
                    "distractor_rationales",
                    sa.JSON(),
                    nullable=False,
                    server_default="{}",
                )
            )
            batch.add_column(
                sa.Column(
                    "is_calculation",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )
            batch.create_index(
                "ix_questions_validation_status", ["validation_status"]
            )

    if not has_column("pathway_recommendations", "source_type"):
        with op.batch_alter_table(
            "pathway_recommendations", naming_convention=SQLITE_NAMING_CONVENTION
        ) as batch:
            batch.add_column(
                sa.Column(
                    "source_type",
                    sa.String(length=30),
                    nullable=False,
                    server_default="Automatic",
                )
            )
            batch.add_column(sa.Column("assigned_by", sa.Integer(), nullable=True))
            batch.add_column(
                sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True)
            )
            batch.add_column(
                sa.Column("due_at", sa.DateTime(timezone=True), nullable=True)
            )
            batch.add_column(
                sa.Column("teacher_note", sa.Text(), nullable=False, server_default="")
            )
            batch.add_column(
                sa.Column(
                    "learner_notified",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )
            batch.add_column(
                sa.Column("supersedes_pathway_id", sa.Integer(), nullable=True)
            )
            batch.add_column(
                sa.Column("difficulty_override", sa.String(length=30), nullable=True)
            )
            batch.create_foreign_key(
                "fk_pathway_recommendations_assigned_by_users",
                "users",
                ["assigned_by"],
                ["id"],
            )
            batch.create_foreign_key(
                "fk_pathway_recommendations_supersedes_pathway_id_pathway_recommendations",
                "pathway_recommendations",
                ["supersedes_pathway_id"],
                ["id"],
            )
            batch.create_index(
                "ix_pathway_recommendations_source_type", ["source_type"]
            )

    if not has_column("pathway_steps", "selection_reason"):
        with op.batch_alter_table(
            "pathway_steps", naming_convention=SQLITE_NAMING_CONVENTION
        ) as batch:
            batch.add_column(
                sa.Column(
                    "selection_reason", sa.Text(), nullable=False, server_default=""
                )
            )
            batch.add_column(
                sa.Column("content", sa.JSON(), nullable=False, server_default="{}")
            )
            batch.add_column(
                sa.Column(
                    "required", sa.Boolean(), nullable=False, server_default=sa.true()
                )
            )
            batch.add_column(
                sa.Column("completion_attempt_id", sa.Integer(), nullable=True)
            )
            batch.create_foreign_key(
                "fk_pathway_steps_completion_attempt_id_assessment_attempts",
                "assessment_attempts",
                ["completion_attempt_id"],
                ["id"],
            )


def downgrade() -> None:
    with op.batch_alter_table(
        "pathway_steps", naming_convention=SQLITE_NAMING_CONVENTION
    ) as batch:
        for column in (
            "completion_attempt_id",
            "required",
            "content",
            "selection_reason",
        ):
            batch.drop_column(column)
    with op.batch_alter_table(
        "pathway_recommendations", naming_convention=SQLITE_NAMING_CONVENTION
    ) as batch:
        batch.drop_index("ix_pathway_recommendations_source_type")
        for column in (
            "difficulty_override",
            "supersedes_pathway_id",
            "learner_notified",
            "teacher_note",
            "due_at",
            "assigned_at",
            "assigned_by",
            "source_type",
        ):
            batch.drop_column(column)
    with op.batch_alter_table(
        "questions", naming_convention=SQLITE_NAMING_CONVENTION
    ) as batch:
        batch.drop_index("ix_questions_validation_status")
        for column in (
            "is_calculation",
            "distractor_rationales",
            "validation_flags",
            "validation_status",
            "solution_steps",
            "source_locator",
        ):
            batch.drop_column(column)
    with op.batch_alter_table("uploaded_documents") as batch:
        batch.drop_column("analysis")
