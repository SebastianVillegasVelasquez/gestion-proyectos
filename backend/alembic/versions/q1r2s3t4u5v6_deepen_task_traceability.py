"""Trazabilidad profunda de tareas: acciones nuevas + delta legible

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2026-08-26

El historial solo sabía de estados (creación, entrega, aprobación, devolución).
Un coordinador que pregunta "¿por qué esta tarea se retrasó?" necesita ver
también que cambió de equipo, que le movieron la ubicación en la estructura y
que le corrieron la fecha — y quién hizo cada cosa.

Dos partes:

  * Cuatro valores nuevos en `history_action`. `ALTER TYPE ... ADD VALUE` no
    puede correr dentro de la transacción que Alembic abre por migración, así
    que va en `autocommit_block()` (mismo patrón que n8o9p0q1r2s3).
  * `old_value` / `new_value` en `task_history`: el delta de esos cambios ya
    resuelto a texto legible ("Contenidos", "Unidad 3", "2026-09-01 →
    2026-09-15"). Texto y no ids ni JSONB porque el historial es un hecho del
    pasado que debe seguir leyéndose aunque el equipo se renombre o el elemento
    se borre, y porque nadie consulta filtrando por estos valores.

Aditivo: columnas nullable y valores de enum nuevos; las filas existentes no
cambian de significado.
"""

import sqlalchemy as sa
from alembic import op

revision = "q1r2s3t4u5v6"
down_revision = "p0q1r2s3t4u5"
branch_labels = None
depends_on = None

# El enum de Postgres guarda los NOMBRES de los miembros (mayúsculas), que es
# como SQLAlchemy serializa `Enum(HistoryAction)` por defecto.
_NEW_ACTIONS = (
    "CAMBIO_EQUIPO",
    "CAMBIO_UBICACION",
    "CAMBIO_FECHAS",
    "CAMBIO_PRIORIDAD",
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in _NEW_ACTIONS:
            op.execute(f"ALTER TYPE history_action ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("task_history", sa.Column("old_value", sa.Text(), nullable=True))
    op.add_column("task_history", sa.Column("new_value", sa.Text(), nullable=True))

    # La trazabilidad lee el historial de un proyecto entero ordenado por fecha;
    # sin este índice es un scan de toda la tabla más un sort.
    op.create_index(
        "ix_task_history_task_created",
        "task_history",
        ["task_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_task_history_task_created", table_name="task_history")
    op.drop_column("task_history", "new_value")
    op.drop_column("task_history", "old_value")
    # Postgres no permite quitar valores de un enum sin recrear el tipo; como
    # son puramente aditivos, se dejan (no afectan a las filas existentes).
