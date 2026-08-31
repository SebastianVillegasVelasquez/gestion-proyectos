"""Agrega DEPENDENCIA_TERCEROS_FECHADA al enum notification_type

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-08-31

Cuando una "actividad de terceros" (tipo con `es_dependencia_externa`) de la
que cuelga trabajo del proyecto recibe o cambia su fecha de entrega, se avisa
a los responsables de las tareas que dependían de ella: ya pueden planificarse.

Ese aviso es del tipo DEPENDENCIA_TERCEROS_FECHADA, que hay que registrar en
el enum de Postgres o el INSERT revienta la transacción (mismo patrón que
z1a2b3c4d5e6). La columna usa `Enum(NotificationType)` SIN `values_callable`,
así que se persiste el NOMBRE en MAYÚSCULAS.

`ALTER TYPE ... ADD VALUE` no puede correr dentro de la transacción de la
migración; se usa `autocommit_block()`.
"""

from alembic import op

revision = "bb22cc33dd44"
down_revision = "aa11bb22cc33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notification_type "
            "ADD VALUE IF NOT EXISTS 'DEPENDENCIA_TERCEROS_FECHADA'"
        )


def downgrade() -> None:
    # Postgres no permite quitar un valor de un enum sin recrearlo; como es
    # puramente aditivo, el downgrade es un no-op intencional.
    pass
