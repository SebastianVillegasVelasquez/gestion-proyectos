"""Agrega TAREA_COMPLETADA y TAREA_DEVUELTA al enum notification_type

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-08-11

La migración que creó el tipo `notification_type` (a1b2c3d4e5f6) se olvidó de
dos valores que el modelo `NotificationType` (Python) sí declara: TAREA_COMPLETADA
y TAREA_DEVUELTA. Como resultado, aprobar una tarea (en_revision → completada) o
devolverla disparaba un evento que intentaba insertar una notificación con un
valor de enum inexistente en Postgres, reventando la transacción completa — la
tarea nunca quedaba en "completada" aunque el flujo era correcto.

`ALTER TYPE ... ADD VALUE` no puede ejecutarse dentro de la transacción que
Alembic abre por migración (Postgres lo prohíbe si el valor se usa en la misma
transacción); se usa `autocommit_block()` para correrlo fuera de ella.
"""

from alembic import op

revision = "n8o9p0q1r2s3"
down_revision = "m7n8o9p0q1r2"
branch_labels = None
depends_on = None

_MISSING_VALUES = ("TAREA_COMPLETADA", "TAREA_DEVUELTA")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in _MISSING_VALUES:
            op.execute(
                f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'"
            )


def downgrade() -> None:
    # Postgres no soporta quitar valores de un enum sin recrear el tipo; dado
    # que son valores puramente aditivos (no cambian el comportamiento de filas
    # existentes), el downgrade es un no-op intencional.
    pass
