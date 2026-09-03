"""Une las tres cabezas del historial de migraciones

Revision ID: m1n2o3p4q5r6
Revises: z0a1b2c3d4e5, z1a2b3c4d5e6, d5e6f7a8b9c0
Create Date: 2026-09-02

El historial se había ramificado en tres puntas (dos ramas colgando de
`y9z0a1b2c3d4` y la de activación de cuenta, `d5e6f7a8b9c0`). Con más de una
cabeza, `alembic upgrade head` —lo que corre el entrypoint del contenedor— falla
con "Multiple head revisions are present" y NINGUNA migración se aplica.

Esta revisión no toca el esquema: solo vuelve a juntar las ramas para que exista
una única cabeza y el arranque funcione.
"""

revision = "m1n2o3p4q5r6"
down_revision = ("z0a1b2c3d4e5", "z1a2b3c4d5e6", "d5e6f7a8b9c0")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
