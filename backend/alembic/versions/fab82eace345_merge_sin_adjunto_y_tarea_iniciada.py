"""Une las dos ramas de migración que salieron de y9z0a1b2c3d4

Revision ID: fab82eace345
Revises: z0a1b2c3d4e5, z1a2b3c4d5e6
Create Date: 2026-08-31

`z0a1b2c3d4e5` (entrega "sin adjunto") y `z1a2b3c4d5e6` (notificación
TAREA_INICIADA) se desarrollaron en ramas paralelas, así que Alembic quedó con
dos cabezas. Esta revisión solo las junta: no toca el esquema.
"""

revision = "fab82eace345"
down_revision = ("z0a1b2c3d4e5", "z1a2b3c4d5e6")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
