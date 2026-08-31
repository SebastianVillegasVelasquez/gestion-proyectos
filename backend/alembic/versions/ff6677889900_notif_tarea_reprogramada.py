"""Agrega TAREA_REPROGRAMADA al enum notification_type

Revision ID: ff6677889900
Revises: ee55ff667788
Create Date: 2026-08-31

Cuando un predecesor despeja el camino —otra tarea se completa, o una
«actividad de terceros» se marca como entregada— las tareas dependientes se
reprograman en cascada (su inicio pasa a la nueva fecha, conservando su
duración) y se avisa a sus responsables. Ese aviso es del tipo
TAREA_REPROGRAMADA, que hay que registrar en el enum de Postgres o el INSERT
revienta la transacción (mismo patrón que DEPENDENCIA_TERCEROS_FECHADA).

`ALTER TYPE ... ADD VALUE` no puede correr dentro de la transacción de la
migración; se usa `autocommit_block()`.
"""

from alembic import op

revision = "ff6677889900"
down_revision = "ee55ff667788"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notification_type "
            "ADD VALUE IF NOT EXISTS 'TAREA_REPROGRAMADA'"
        )


def downgrade() -> None:
    # Postgres no permite quitar un valor de un enum sin recrearlo; como es
    # puramente aditivo, el downgrade es un no-op intencional.
    pass
