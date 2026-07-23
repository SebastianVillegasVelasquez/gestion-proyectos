"""Add client_access_token to projects

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-21

Token secreto por proyecto para el portal público del cliente (/portal/{token}).
Aditivo: columna nullable + índice único. Los proyectos existentes reciben su
token de forma perezosa (al pedir el enlace) — no hace falta backfill.
"""

import sqlalchemy as sa
from alembic import op

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("client_access_token", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_projects_client_access_token",
        "projects",
        ["client_access_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_projects_client_access_token", table_name="projects")
    op.drop_column("projects", "client_access_token")
