"""Add persistent learner onboarding and the system diagnostic marker.

Revision ID: 0007_learner_onboarding
Revises: 0006_teacher_refinement_evidence
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_learner_onboarding"
down_revision = "0006_teacher_refinement_evidence"
branch_labels = None
depends_on = None


def has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return inspector.has_table(table) and column in {
        item["name"] for item in inspector.get_columns(table)
    }


def upgrade() -> None:
    if not has_column("student_profiles", "onboarding_completed_at"):
        with op.batch_alter_table("student_profiles") as batch:
            batch.add_column(
                sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True)
            )
    if not has_column("student_profiles", "onboarding_version"):
        with op.batch_alter_table("student_profiles") as batch:
            batch.add_column(
                sa.Column(
                    "onboarding_version",
                    sa.String(length=20),
                    nullable=False,
                    server_default="1.0",
                )
            )
    # Every profile that predates this feature is a returning learner. This
    # prevents a release from replaying onboarding for existing accounts.
    op.execute(
        sa.text(
            "UPDATE student_profiles "
            "SET onboarding_completed_at = CURRENT_TIMESTAMP "
            "WHERE onboarding_completed_at IS NULL"
        )
    )
    if not has_column("activities", "is_onboarding_diagnostic"):
        with op.batch_alter_table("activities") as batch:
            batch.add_column(
                sa.Column(
                    "is_onboarding_diagnostic",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )


def downgrade() -> None:
    if has_column("activities", "is_onboarding_diagnostic"):
        with op.batch_alter_table("activities") as batch:
            batch.drop_column("is_onboarding_diagnostic")
    if has_column("student_profiles", "onboarding_version"):
        with op.batch_alter_table("student_profiles") as batch:
            batch.drop_column("onboarding_version")
    if has_column("student_profiles", "onboarding_completed_at"):
        with op.batch_alter_table("student_profiles") as batch:
            batch.drop_column("onboarding_completed_at")
