"""Entrega "sin adjunto": nuevo resource_type y url opcional

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-08-31

"Entregar sin adjunto" pasa a crear un entregable de verdad (antes solo movía
el estado de la tarea, y el líder no tenía nada que revisar en la pestaña de
entregables). Esa entrega es una versión de tipo `sin_adjunto` sin URL:

  - se añade el valor `sin_adjunto` al enum `resource_type`;
  - `deliverable_versions.url` deja de ser NOT NULL.

`ALTER TYPE ... ADD VALUE` no puede ir dentro de la transacción de la
migración (Postgres lo prohíbe); se usa `autocommit_block()`.
"""

import sqlalchemy as sa
from alembic import op

revision = "z0a1b2c3d4e5"
down_revision = "y9z0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'sin_adjunto'")
    op.alter_column(
        "deliverable_versions",
        "url",
        existing_type=sa.String(length=1000),
        nullable=True,
    )


def downgrade() -> None:
    # Rellena las entregas sin adjunto antes de volver a poner NOT NULL, para no
    # fallar si ya existen filas con url NULL.
    op.execute("UPDATE deliverable_versions SET url = '' WHERE url IS NULL")
    op.alter_column(
        "deliverable_versions",
        "url",
        existing_type=sa.String(length=1000),
        nullable=False,
    )
    # Postgres no permite quitar un valor de un enum sin recrearlo; como es
    # puramente aditivo, el downgrade del enum es un no-op intencional.
