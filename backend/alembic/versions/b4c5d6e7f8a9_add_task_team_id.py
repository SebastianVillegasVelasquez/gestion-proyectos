"""Add team_id to tasks (delegate a task to a team)

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-21

Fase 1 del flujo del espacio de trabajo: una tarea puede estar delegada a un
equipo (el líder luego reparte subtareas). Aditivo: columna nullable + índice +
FK con ON DELETE SET NULL (si se borra el equipo, la tarea no se pierde, solo
queda sin equipo). No afecta las tareas existentes.
"""

import sqlalchemy as sa
from alembic import op

revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("team_id", sa.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_tasks_team_id", "tasks", ["team_id"])
    op.create_foreign_key(
        "fk_tasks_team_id_teams",
        "tasks",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_team_id_teams", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_team_id", table_name="tasks")
    op.drop_column("tasks", "team_id")
