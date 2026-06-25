"""Add team workspace (deliverables, versions, comments)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-20

Espacio de trabajo dentro del bounded context de teams: cada entregable pertenece
a un equipo (la información se queda en él), con su línea de tiempo de entregas
(versiones con recurso/URL) y su hilo de retroalimentación.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


deliverable_status = postgresql.ENUM(name="deliverable_status", create_type=False)
resource_type = postgresql.ENUM(name="resource_type", create_type=False)
comment_type = postgresql.ENUM(name="comment_type", create_type=False)


def _timestamps() -> list:
    return [
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.execute(
        "CREATE TYPE deliverable_status AS ENUM "
        "('borrador', 'en_revision', 'aprobado', 'cambios_solicitados')"
    )
    op.execute(
        "CREATE TYPE resource_type AS ENUM ('enlace', 'repositorio', 'scorm', 'archivo')"
    )
    op.execute(
        "CREATE TYPE comment_type AS ENUM "
        "('comentario', 'solicitud_cambio', 'aprobacion')"
    )

    op.create_table(
        "team_deliverables",
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("task_title", sa.String(length=300), nullable=False),
        sa.Column("assignee_id", sa.UUID(), nullable=False),
        sa.Column(
            "status", deliverable_status, nullable=False, server_default="borrador"
        ),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "deliverable_versions",
        sa.Column("deliverable_id", sa.UUID(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("resource_type", resource_type, nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["deliverable_id"], ["team_deliverables.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "deliverable_id", "version_number", name="uq_deliverable_version"
        ),
    )

    op.create_table(
        "deliverable_comments",
        sa.Column("deliverable_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "comment_type", comment_type, nullable=False, server_default="comentario"
        ),
        sa.Column(
            "mentions",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["deliverable_id"], ["team_deliverables.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("deliverable_comments")
    op.drop_table("deliverable_versions")
    op.drop_table("team_deliverables")
    op.execute("DROP TYPE IF EXISTS comment_type")
    op.execute("DROP TYPE IF EXISTS resource_type")
    op.execute("DROP TYPE IF EXISTS deliverable_status")
