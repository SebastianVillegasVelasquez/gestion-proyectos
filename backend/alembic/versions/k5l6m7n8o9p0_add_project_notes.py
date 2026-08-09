"""Add project_notes table

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-08-09

Notas/recordatorios por proyecto: contenido, fecha propia (por defecto hoy) y
autor. Aditivo: tabla nueva con FK a projects (ON DELETE CASCADE) y a users
(ON DELETE SET NULL, la nota sobrevive si se borra el autor). Borrado lógico
vía deleted_at. No afecta datos existentes.
"""

import sqlalchemy as sa
from alembic import op

revision = "k5l6m7n8o9p0"
down_revision = "j4k5l6m7n8o9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_notes",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("note_date", sa.Date(), nullable=False),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_notes_project_id", "project_notes", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_project_notes_project_id", table_name="project_notes")
    op.drop_table("project_notes")
