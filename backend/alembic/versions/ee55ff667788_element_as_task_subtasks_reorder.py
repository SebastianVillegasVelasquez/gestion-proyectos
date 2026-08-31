"""Elemento que es tarea, orden de tareas y entregables personales

Revision ID: ee55ff667788
Revises: dd44ee55ff66
Create Date: 2026-08-31

Tres cambios que habilitan la misma tanda de features:

- `tasks.orden`: posición de una tarea entre sus hermanas (mismo elemento y
  misma tarea padre). Sirve para reordenar por prioridad / orden de
  cumplimiento sin tocar fechas. Se rellena numerando cada grupo por
  `created_at`.
- `tasks.represents_work_item`: marca la tarea que ES el elemento de la
  estructura (Elemento 1 puede ser, a la vez, un contenedor y una tarea
  asignable). Índice único parcial: como mucho una por elemento vivo.
- `team_deliverables.team_id` pasa a NULLABLE: un entregable sin equipo es un
  entregable personal, propiedad de su `assignee_id` (la persona con una
  tarea individual también necesita una pantalla para entregar).
"""

import sqlalchemy as sa
from alembic import op

revision = "ee55ff667788"
down_revision = "dd44ee55ff66"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tasks.orden ───────────────────────────────────────────────────────────
    op.add_column(
        "tasks",
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )
    # Numera cada grupo de hermanas (proyecto + elemento + tarea padre) por
    # antigüedad, para que el orden inicial sea el de creación.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY project_id, work_item_id, parent_task_id
                    ORDER BY created_at, id
                ) - 1 AS rn
            FROM tasks
        )
        UPDATE tasks AS t
        SET orden = ranked.rn
        FROM ranked
        WHERE ranked.id = t.id
        """
    )

    # ── tasks.represents_work_item ────────────────────────────────────────────
    op.add_column(
        "tasks",
        sa.Column(
            "represents_work_item",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index(
        "uq_task_represents_work_item",
        "tasks",
        ["work_item_id"],
        unique=True,
        postgresql_where=sa.text("represents_work_item AND deleted_at IS NULL"),
    )

    # ── team_deliverables.team_id nullable (entregables personales) ────────────
    op.alter_column(
        "team_deliverables",
        "team_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # Los entregables personales no caben en el modelo antiguo: se descartan
    # antes de volver a exigir el equipo.
    op.execute("DELETE FROM team_deliverables WHERE team_id IS NULL")
    op.alter_column(
        "team_deliverables",
        "team_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=False,
    )

    op.drop_index("uq_task_represents_work_item", table_name="tasks")
    op.drop_column("tasks", "represents_work_item")
    op.drop_column("tasks", "orden")
