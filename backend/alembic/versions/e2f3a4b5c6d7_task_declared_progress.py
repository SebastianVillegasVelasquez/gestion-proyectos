"""Task declared progress and its evidence log

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-10-14

El responsable de una tarea puede declarar su avance y cada edición exige una
evidencia (un archivo o una versión de su entregable):

- `tasks.manual_progress_pct`: avance declarado (NULL = sale del estado).
- `task_progress_updates`: bitácora de cada edición con su evidencia.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks", sa.Column("manual_progress_pct", sa.Integer(), nullable=True)
    )

    op.create_table(
        "task_progress_updates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("previous_pct", sa.Integer(), nullable=False),
        sa.Column("new_pct", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("project_files.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "deliverable_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("deliverable_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("new_pct BETWEEN 0 AND 99", name="ck_progress_update_range"),
    )
    op.create_index(
        "ix_task_progress_updates_task_id", "task_progress_updates", ["task_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_task_progress_updates_task_id", table_name="task_progress_updates"
    )
    op.drop_table("task_progress_updates")
    op.drop_column("tasks", "manual_progress_pct")
