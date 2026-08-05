"""Initial NeuroLearn-X research schema.

Revision ID: 0001
Revises:
Create Date: 2026-07-30
"""
from alembic import op

from app.database import Base
from app import models  # noqa: F401


revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=True)
