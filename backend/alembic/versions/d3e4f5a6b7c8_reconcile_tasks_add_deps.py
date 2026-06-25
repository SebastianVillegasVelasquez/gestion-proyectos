"""Reconcile tasks table with model, add subtasks, history and dependencies

The original init migration created a minimal `tasks` table (status as VARCHAR,
no priority/completed_at) that had drifted from the ORM model. Since there is no
production data yet, we recreate `tasks` to match the model and add the new
`task_history` and `task_dependencies` tables plus `parent_task_id`.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-14 19:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Reference the PG enum types without letting create_table auto-create them;
# we create the types once via raw SQL below.
task_status = postgresql.ENUM(name="task_status", create_type=False)
task_priority = postgresql.ENUM(name="task_priority", create_type=False)
history_action = postgresql.ENUM(name="history_action", create_type=False)


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
    op.drop_table("tasks")

    op.execute(
        "CREATE TYPE task_status AS ENUM "
        "('PENDIENTE_POR_INICIAR', 'EN_PROGRESO', 'EN_REVISION', "
        "'DEVUELTA', 'COMPLETADA', 'CANCELADA')"
    )
    op.execute(
        "CREATE TYPE task_priority AS ENUM "
        "('NO_DEFINIDA', 'BAJA', 'MEDIA', 'ALTA', 'URGENTE')"
    )
    op.execute(
        "CREATE TYPE history_action AS ENUM "
        "('CREACION', 'CAMBIO_ESTADO', 'REASIGNACION', 'COMENTARIO')"
    )

    op.create_table(
        "tasks",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            task_status,
            nullable=False,
            server_default="PENDIENTE_POR_INICIAR",
        ),
        sa.Column(
            "priority", task_priority, nullable=False, server_default="NO_DEFINIDA"
        ),
        sa.Column("node_id", sa.UUID(), nullable=False),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("parent_task_id", sa.UUID(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["node_id"], ["project_nodes.id"]),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["parent_task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tasks_node_id"), "tasks", ["node_id"], unique=False)

    op.create_table(
        "task_history",
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("changed_by_id", sa.UUID(), nullable=True),
        sa.Column("action", history_action, nullable=False),
        sa.Column("old_status", task_status, nullable=True),
        sa.Column("new_status", task_status, nullable=True),
        sa.Column("change_reason", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "task_dependencies",
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("depends_on_id", sa.UUID(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["depends_on_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
    )


def downgrade() -> None:
    op.drop_table("task_dependencies")
    op.drop_table("task_history")
    op.drop_index(op.f("ix_tasks_node_id"), table_name="tasks")
    op.drop_table("tasks")

    op.execute("DROP TYPE IF EXISTS history_action")
    op.execute("DROP TYPE IF EXISTS task_priority")
    op.execute("DROP TYPE IF EXISTS task_status")

    op.create_table(
        "tasks",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("node_id", sa.UUID(), nullable=False),
        sa.Column("assignee_id", sa.UUID(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["node_id"], ["project_nodes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
