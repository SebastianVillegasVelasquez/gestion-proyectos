"""Tipo de nodo: flag `es_dependencia_externa`

Revision ID: aa11bb22cc33
Revises: fab82eace345
Create Date: 2026-08-31

El comportamiento de "Actividad de terceros" (el nodo se pone delante de sus
hermanos, que pasan a colgar de él y a depender de él; su fecha la fija alguien
de fuera y el resto del trabajo la espera) dejaba de ser un caso especial
atado al NOMBRE del tipo y pasa a ser una propiedad booleana del tipo. Así el
tipo se puede renombrar sin perder el comportamiento.

Los tipos que hoy se llaman "Actividad de terceros" se marcan con el flag para
no romper los proyectos que ya lo usan.
"""

import sqlalchemy as sa
from alembic import op

revision = "aa11bb22cc33"
down_revision = "fab82eace345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tipos_nodo",
        sa.Column(
            "es_dependencia_externa",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Preserva el comportamiento de los tipos existentes creados por nombre.
    op.execute(
        "UPDATE tipos_nodo SET es_dependencia_externa = true "
        "WHERE lower(btrim(nombre)) = 'actividad de terceros'"
    )


def downgrade() -> None:
    op.drop_column("tipos_nodo", "es_dependencia_externa")
