"""Aprobación opcional al entregar una tarea

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-08-30

Añade `tasks.requires_approval`. Desactivado por defecto (`False`): el
responsable entrega y la tarea queda COMPLETADA directo, sin pasar por el
líder/supervisor. Se activa solo cuando la tarea se marca explícitamente para
exigir revisión (`EN_REVISION` → aprobar/devolver), tanto al asignarla
individualmente desde el proyecto como al repartirla el líder desde la bolsa
de su equipo.
"""

import sqlalchemy as sa
from alembic import op

revision = "y9z0a1b2c3d4"
down_revision = "x8y9z0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "requires_approval",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("tasks", "requires_approval")
