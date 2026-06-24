"""Add performance indexes on FKs and filtered columns

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-06-24

Postgres NO indexa las claves foráneas automáticamente. Estas columnas se filtran
/ordenan/joinean en los caminos más consultados (dashboard, colaboradores, equipos)
y carecían de índice. Cubrimos las FK y columnas de filtrado de mayor tráfico.

Notas:
- team_members(team_id, user_id) y task_dependencies(task_id, depends_on_id) ya
  tienen UNIQUE compuesto: el prefijo (primera columna) queda cubierto, así que
  solo indexamos la SEGUNDA columna (user_id / depends_on_id).
- deliverable_versions(deliverable_id) ya está cubierto por su UNIQUE
  (deliverable_id, version_number); no se duplica.
- tasks.status es un ENUM y el dashboard lo compara con cast(status, String); un
  índice B-tree plano puede NO usarse mientras se mantenga ese cast. Se incluye
  igualmente (barato), pero el fix real es comparar contra el enum sin cast.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (nombre_índice, tabla, columna)
_INDEXES: list[tuple[str, str, str]] = [
    ("ix_tasks_assignee_id", "tasks", "assignee_id"),
    ("ix_tasks_status", "tasks", "status"),
    ("ix_tasks_due_date", "tasks", "due_date"),
    ("ix_tasks_parent_task_id", "tasks", "parent_task_id"),
    ("ix_project_members_user_id", "project_members", "user_id"),
    ("ix_project_members_project_id", "project_members", "project_id"),
    ("ix_team_members_user_id", "team_members", "user_id"),
    ("ix_task_history_changed_by_id", "task_history", "changed_by_id"),
    ("ix_task_history_task_id", "task_history", "task_id"),
    ("ix_task_dependencies_depends_on_id", "task_dependencies", "depends_on_id"),
    ("ix_team_deliverables_team_id", "team_deliverables", "team_id"),
    (
        "ix_deliverable_comments_deliverable_id",
        "deliverable_comments",
        "deliverable_id",
    ),
]


def upgrade() -> None:
    for name, table, column in _INDEXES:
        op.create_index(name, table, [column])


def downgrade() -> None:
    for name, table, _column in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
