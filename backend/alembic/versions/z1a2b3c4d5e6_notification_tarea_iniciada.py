"""Agrega TAREA_INICIADA al enum notification_type

Revision ID: z1a2b3c4d5e6
Revises: y9z0a1b2c3d4
Create Date: 2026-08-31

Cuando el responsable marca que empezó una tarea (PENDIENTE → EN_PROGRESO) se
avisa a quien coordina. Ese aviso es una notificación de tipo TAREA_INICIADA,
que hay que registrar en el enum de Postgres o el INSERT revienta la
transacción (mismo patrón que n8o9p0q1r2s3).

Ojo con el CASING: la columna `notifications.notification_type` usa
`Enum(NotificationType)` SIN `values_callable`, así que SQLAlchemy persiste el
NOMBRE del miembro en MAYÚSCULAS (`TAREA_INICIADA`), no su value en minúsculas.
Igual que `TAREA_COMPLETADA` / `RECORDATORIO` en migraciones anteriores.

`ALTER TYPE ... ADD VALUE` no puede correr dentro de la transacción de la
migración; se usa `autocommit_block()`.
"""

from alembic import op

revision = "z1a2b3c4d5e6"
down_revision = "y9z0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TAREA_INICIADA'"
        )


def downgrade() -> None:
    # Postgres no permite quitar un valor de un enum sin recrearlo; como es
    # puramente aditivo, el downgrade es un no-op intencional.
    pass
