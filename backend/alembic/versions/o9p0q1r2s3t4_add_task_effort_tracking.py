"""Add task effort tracking (estimated hours + time entries)

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-08-26

Esfuerzo de una tarea en dos piezas: `tasks.estimated_hours` (lo que se cree
que costará) y `task_time_entries` (lo que costó de verdad, apuntado por día y
por persona). Comparar ambos es lo que permite planificar con datos y sostener
un modelo de pago por horas dedicadas.

Aditivo: la columna es nullable (las tareas existentes se quedan sin estimar) y
la tabla es nueva, con FK en cascada a tasks y users.
"""

import sqlalchemy as sa
from alembic import op

revision = "o9p0q1r2s3t4"
down_revision = "n8o9p0q1r2s3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("estimated_hours", sa.Numeric(precision=6, scale=2), nullable=True),
    )
    op.create_table(
        "task_time_entries",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("task_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("hours", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_time_entries_task_id", "task_time_entries", ["task_id"])
    op.create_index("ix_task_time_entries_user_id", "task_time_entries", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_task_time_entries_user_id", table_name="task_time_entries")
    op.drop_index("ix_task_time_entries_task_id", table_name="task_time_entries")
    op.drop_table("task_time_entries")
    op.drop_column("tasks", "estimated_hours")
