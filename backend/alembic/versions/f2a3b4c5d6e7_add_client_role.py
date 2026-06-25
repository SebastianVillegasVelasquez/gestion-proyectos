"""Add CLIENT system role

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-24

Rol CLIENT: acceso restringido para clientes externos (solo ven el resumen de su
proyecto). Aditivo. `ALTER TYPE ... ADD VALUE` en autocommit_block.
"""

from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLIENT'")


def downgrade() -> None:
    # Postgres no permite quitar valores de un enum sin recrear el tipo; aditivo → no-op.
    pass
