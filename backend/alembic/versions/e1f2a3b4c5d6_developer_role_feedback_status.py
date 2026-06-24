"""Add DEVELOPER system role and feedback status

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-06-24

- Añade el valor DEVELOPER al enum `user_role` (rol técnico, tope de jerarquía).
- Añade el enum `feedback_status` y la columna `feedback.status` para que el
  developer gestione cada feedback (pendiente/realizado/imposible/…).

Los enums nativos almacenan por NOMBRE (mayúscula), igual que el resto del esquema.
`ALTER TYPE ... ADD VALUE` va en autocommit_block (no puede compartir transacción).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None

_FEEDBACK_STATUS_VALUES = (
    "PENDIENTE",
    "REALIZADO",
    "IMPOSIBLE",
    "MAS_TARDE",
    "DESCARTADO",
)


def upgrade() -> None:
    # 1) Nuevo rol DEVELOPER en el enum existente user_role.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DEVELOPER'")

    # 2) Estado de gestión del feedback.
    labels = ", ".join(f"'{value}'" for value in _FEEDBACK_STATUS_VALUES)
    op.execute(f"CREATE TYPE feedback_status AS ENUM ({labels})")
    op.add_column(
        "feedback",
        sa.Column(
            "status",
            postgresql.ENUM(name="feedback_status", create_type=False),
            nullable=False,
            server_default="PENDIENTE",
        ),
    )


def downgrade() -> None:
    op.drop_column("feedback", "status")
    op.execute("DROP TYPE feedback_status")
    # Postgres no permite quitar un valor de un enum sin recrear el tipo; como es
    # aditivo y no se usa en datos previos, el downgrade del rol es un no-op.
