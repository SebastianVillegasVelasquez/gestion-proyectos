"""Esfuerzo de tareas: de horas a días

Revision ID: cc33dd44ee55
Revises: bb22cc33dd44
Create Date: 2026-08-31

El esfuerzo de una tarea (estimado y dedicado) se mide ahora en DÍAS, no en
horas. Es un rename de columnas, sin conversión de valores: los números
existentes se re-interpretan como días. Para los datos de prueba actuales es
lo esperado; si algún proyecto real tuviera horas cargadas habría que dividir
aparte (fuera del alcance de esta migración).

- `tasks.estimated_hours`      -> `tasks.estimated_days`
- `task_time_entries.hours`    -> `task_time_entries.days`
"""

from alembic import op

revision = "cc33dd44ee55"
down_revision = "bb22cc33dd44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tasks", "estimated_hours", new_column_name="estimated_days")
    op.alter_column("task_time_entries", "hours", new_column_name="days")


def downgrade() -> None:
    op.alter_column("task_time_entries", "days", new_column_name="hours")
    op.alter_column("tasks", "estimated_days", new_column_name="estimated_hours")
