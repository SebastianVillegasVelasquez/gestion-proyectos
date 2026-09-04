"""Agrega SUBTAREA_ASIGNADA y TAREA_POR_VENCER al enum notification_type

Revision ID: p1q2r3s4t5u6
Revises: 4d1a97be0c35
Create Date: 2026-09-04

Dos alertas nuevas que el modelo `NotificationType` (Python) ya declara:

  * SUBTAREA_ASIGNADA — asignar una subtarea (cuelga de otra tarea) dispara un
    aviso distinto de asignar una tarea general, para que quien lo recibe
    sepa de inmediato qué tipo de trabajo le llegó.
  * TAREA_POR_VENCER — aviso preventivo antes de que una tarea venza (no solo
    después, que es lo que ya cubre TAREA_ATRASADA).

`ALTER TYPE ... ADD VALUE` no puede ejecutarse dentro de la transacción que
Alembic abre por migración; se usa `autocommit_block()` para correrlo fuera.
"""

from alembic import op

revision = "p1q2r3s4t5u6"
down_revision = "4d1a97be0c35"
branch_labels = None
depends_on = None

_NEW_VALUES = ("SUBTAREA_ASIGNADA", "TAREA_POR_VENCER")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in _NEW_VALUES:
            op.execute(
                f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'"
            )


def downgrade() -> None:
    # Postgres no soporta quitar valores de un enum sin recrear el tipo; dado
    # que son valores puramente aditivos, el downgrade es un no-op intencional.
    pass
