"""Activación de cuenta por enlace: token de un solo uso en users

Revision ID: d5e6f7a8b9c0
Revises: f1a2c3e4d5b6
Create Date: 2026-09-02

En vez de mandar una contraseña temporal por correo, el alta genera un token de
activación de un solo uso. Se guarda su SHA-256 (nunca el token en claro) y su
caducidad; ambos se limpian al activar la cuenta. Ambas columnas son nulables:
null = cuenta ya activada o anterior a este flujo.
"""

import sqlalchemy as sa
from alembic import op

revision = "d5e6f7a8b9c0"
down_revision = "f1a2c3e4d5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("activation_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "activation_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_activation_token_hash",
        "users",
        ["activation_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_users_activation_token_hash", table_name="users")
    op.drop_column("users", "activation_token_expires_at")
    op.drop_column("users", "activation_token_hash")
