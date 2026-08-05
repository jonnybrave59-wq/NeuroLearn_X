"""Add student accounts, document authoring, question bank, and assessments.

Revision ID: 0002_accounts_authoring
Revises: 0001
Create Date: 2026-07-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_accounts_authoring"
down_revision = "0001"
branch_labels = None
depends_on = None

SQLITE_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def upgrade() -> None:
    # The original 0001 migration creates the then-current SQLAlchemy metadata.
    # On a brand-new installation that metadata already includes this revision's
    # schema, while an existing 0001 database still needs the alterations below.
    # This guard keeps both upgrade paths safe.
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    if {
        "login_history",
        "uploaded_documents",
        "assessments",
        "assessment_questions",
        "assessment_assignments",
    }.issubset(existing_tables):
        return

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("username", sa.String(length=80), nullable=True))
        batch.add_column(sa.Column("email", sa.String(length=180), nullable=True))
        batch.add_column(sa.Column("first_name", sa.String(length=80), nullable=True))
        batch.add_column(sa.Column("last_name", sa.String(length=80), nullable=True))
        batch.add_column(
            sa.Column(
                "account_status",
                sa.String(length=20),
                nullable=False,
                server_default="Active",
            )
        )
        batch.add_column(sa.Column("last_sign_in_at", sa.DateTime(timezone=True)))
        batch.create_unique_constraint("uq_users_username", ["username"])
        batch.create_unique_constraint("uq_users_email", ["email"])
        batch.create_index("ix_users_account_status", ["account_status"])

    with op.batch_alter_table("student_profiles") as batch:
        batch.add_column(sa.Column("section", sa.String(length=80), nullable=True))

    op.create_table(
        "login_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("participant_code", sa.String(length=80), nullable=False),
        sa.Column("successful", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column("user_agent", sa.String(length=300), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_history_user_id", "login_history", ["user_id"])
    op.create_index(
        "ix_login_history_participant_code",
        "login_history",
        ["participant_code"],
    )
    op.create_index("ix_login_history_successful", "login_history", ["successful"])
    op.create_index("ix_login_history_occurred_at", "login_history", ["occurred_at"])

    op.create_table(
        "uploaded_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=20), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "processing_status",
            sa.String(length=30),
            nullable=False,
            server_default="Ready",
        ),
        sa.Column("extracted_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("error_message", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("file_type", "content_sha256", "uploaded_by", "processing_status"):
        op.create_index(f"ix_uploaded_documents_{column}", "uploaded_documents", [column])

    with op.batch_alter_table(
        "questions", naming_convention=SQLITE_NAMING_CONVENTION
    ) as batch:
        batch.alter_column("activity_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(
            sa.Column(
                "question_type",
                sa.String(length=30),
                nullable=False,
                server_default="Multiple choice",
            )
        )
        batch.add_column(
            sa.Column("correct_answer", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("explanation", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column(
                "difficulty_label",
                sa.String(length=20),
                nullable=False,
                server_default="Moderate",
            )
        )
        batch.add_column(
            sa.Column(
                "cognitive_level",
                sa.String(length=40),
                nullable=False,
                server_default="Understand",
            )
        )
        batch.add_column(
            sa.Column(
                "subject",
                sa.String(length=100),
                nullable=False,
                server_default="General Physics",
            )
        )
        batch.add_column(
            sa.Column("topic", sa.String(length=160), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column(
                "learning_competency", sa.Text(), nullable=False, server_default=""
            )
        )
        batch.add_column(
            sa.Column(
                "source_type",
                sa.String(length=50),
                nullable=False,
                server_default="Manually created",
            )
        )
        batch.add_column(
            sa.Column(
                "source_document_id",
                sa.Integer(),
                nullable=True,
            )
        )
        batch.add_column(
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default="Draft",
            )
        )
        batch.add_column(
            sa.Column(
                "created_by",
                sa.Integer(),
                nullable=True,
            )
        )
        batch.create_foreign_key(
            "fk_questions_source_document_id_uploaded_documents",
            "uploaded_documents",
            ["source_document_id"],
            ["id"],
        )
        batch.create_foreign_key(
            "fk_questions_created_by_users",
            "users",
            ["created_by"],
            ["id"],
        )
        for column in (
            "question_type",
            "difficulty_label",
            "cognitive_level",
            "subject",
            "topic",
            "source_type",
            "source_document_id",
            "status",
            "created_by",
        ):
            batch.create_index(f"ix_questions_{column}", [column])

    with op.batch_alter_table("item_responses") as batch:
        batch.add_column(sa.Column("response_text", sa.Text(), nullable=True))

    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "subject",
            sa.String(length=100),
            nullable=False,
            server_default="General Physics",
        ),
        sa.Column("topic", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="Draft"),
        sa.Column(
            "mastery_threshold", sa.Float(), nullable=False, server_default="0.75"
        ),
        sa.Column("time_limit", sa.Integer(), nullable=True),
        sa.Column("maximum_attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("available_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "shuffle_questions", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "shuffle_choices", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "show_score_immediately",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "show_explanations", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("allow_retake", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assessments_status", "assessments", ["status"])
    op.create_index("ix_assessments_created_by", "assessments", ["created_by"])

    op.create_table(
        "assessment_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "assessment_id",
            sa.Integer(),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("assessment_id", "question_id"),
    )
    op.create_index(
        "ix_assessment_questions_assessment_id",
        "assessment_questions",
        ["assessment_id"],
    )
    op.create_index(
        "ix_assessment_questions_question_id",
        "assessment_questions",
        ["question_id"],
    )

    op.create_table(
        "assessment_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "assessment_id",
            sa.Integer(),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("section", sa.String(length=80), nullable=True),
        sa.UniqueConstraint("assessment_id", "student_id", "section"),
    )
    op.create_index(
        "ix_assessment_assignments_assessment_id",
        "assessment_assignments",
        ["assessment_id"],
    )
    op.create_index(
        "ix_assessment_assignments_student_id",
        "assessment_assignments",
        ["student_id"],
    )
    op.create_index(
        "ix_assessment_assignments_section",
        "assessment_assignments",
        ["section"],
    )


def downgrade() -> None:
    op.drop_table("assessment_assignments")
    op.drop_table("assessment_questions")
    op.drop_table("assessments")
    with op.batch_alter_table("item_responses") as batch:
        batch.drop_column("response_text")
    with op.batch_alter_table(
        "questions", naming_convention=SQLITE_NAMING_CONVENTION
    ) as batch:
        for column in (
            "created_by",
            "status",
            "source_document_id",
            "source_type",
            "learning_competency",
            "topic",
            "subject",
            "cognitive_level",
            "difficulty_label",
            "explanation",
            "correct_answer",
            "question_type",
        ):
            batch.drop_column(column)
        batch.alter_column("activity_id", existing_type=sa.Integer(), nullable=False)
    op.drop_table("uploaded_documents")
    op.drop_table("login_history")
    with op.batch_alter_table("student_profiles") as batch:
        batch.drop_column("section")
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_account_status")
        batch.drop_constraint("uq_users_email", type_="unique")
        batch.drop_constraint("uq_users_username", type_="unique")
        for column in (
            "last_sign_in_at",
            "account_status",
            "last_name",
            "first_name",
            "email",
            "username",
        ):
            batch.drop_column(column)
