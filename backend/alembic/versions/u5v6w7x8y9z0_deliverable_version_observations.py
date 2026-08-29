"""Observaciones internas en la versión de un entregable

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-08-28

Fase 3.1: quien entrega deja instrucciones para el siguiente rol de la cadena.
Aditivo: columna de texto nullable en `deliverable_versions`. Dato interno del
equipo (no aparece en informes ni paneles al cliente). No afecta las filas
existentes.
"""

import sqlalchemy as sa
from alembic import op

revision = "u5v6w7x8y9z0"
down_revision = "t4u5v6w7x8y9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "deliverable_versions",
        sa.Column("observations", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("deliverable_versions", "observations")
