"""Obligar cambio de contraseña en el primer ingreso

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-08-29

Añade `users.must_change_password`. Se pone con server_default 'false' para NO
bloquear a las cuentas que ya existen en producción; las cuentas nuevas nacen
con True desde la aplicación (default del modelo) y el reset de admin lo vuelve
a poner en True.
"""

import sqlalchemy as sa
from alembic import op

revision = "w7x8y9z0a1b2"
down_revision = "v6w7x8y9z0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
