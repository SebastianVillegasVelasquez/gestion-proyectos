"""Link deliverable to a real Task

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-07-22

Fase 2: cada entregable puede apuntar a una Task real del proyecto, para que
entregar/aprobar/rechazar mueva el estado de la tarea y quede en trazabilidad.
Aditivo: columna nullable (compat con entregables sueltos existentes) + FK con
ON DELETE SET NULL + índice único parcial (una tarea, un entregable vivo).
"""

import sqlalchemy as sa
from alembic import op

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "team_deliverables",
        sa.Column("task_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_team_deliverables_task_id_tasks",
        "team_deliverables",
        "tasks",
        ["task_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Índice único parcial: una tarea sólo puede tener un entregable vivo. Los
    # soft-deletes no cuentan (deleted_at NOT NULL), para no bloquear el borrado
    # lógico + recreación.
    op.create_index(
        "ux_team_deliverables_task_alive",
        "team_deliverables",
        ["task_id"],
        unique=True,
        postgresql_where=sa.text("task_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_team_deliverables_task_alive", table_name="team_deliverables")
    op.drop_constraint(
        "fk_team_deliverables_task_id_tasks", "team_deliverables", type_="foreignkey"
    )
    op.drop_column("team_deliverables", "task_id")
