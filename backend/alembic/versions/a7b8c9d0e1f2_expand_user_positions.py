"""Expand user_position enum (virtualización + TI)

Revision ID: a7b8c9d0e1f2
Revises: d4e5f6a7b8c9
Create Date: 2026-06-20

Añade nuevos cargos al tipo nativo ``user_position`` para que cada usuario pueda
definir su posición al registrarse. Aditivo: no toca datos existentes (los valores
previos siguen siendo válidos).

Nota: el tipo enum de Postgres almacena por NOMBRE de miembro (mayúsculas). Se usa
``ADD VALUE IF NOT EXISTS`` dentro de un autocommit_block porque ALTER TYPE ... ADD
VALUE no puede compartir transacción con su uso posterior.
"""

from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None

# Nombres de miembro nuevos (coinciden con UserPosition en infrastructure/enums.py).
NEW_POSITIONS = [
    # Virtualización / e-learning
    "COORDINADOR_VIRTUALIZACION",
    "DESARROLLADOR_ELEARNING",
    "PRODUCTOR_AUDIOVISUAL",
    "EDITOR_VIDEO",
    "TUTOR_VIRTUAL",
    "CONTROL_CALIDAD",
    # TI
    "DESARROLLADOR_FRONTEND",
    "DESARROLLADOR_BACKEND",
    "INGENIERO_DEVOPS",
    "DISENADOR_UX_UI",
    "ADMINISTRADOR_BD",
    "ANALISTA_QA",
    "SOPORTE_TECNICO",
    # Gestión / coordinación
    "LIDER_TECNICO",
    "ANALISTA_FUNCIONAL",
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name in NEW_POSITIONS:
            op.execute(f"ALTER TYPE user_position ADD VALUE IF NOT EXISTS '{name}'")


def downgrade() -> None:
    # Postgres no soporta eliminar valores de un enum sin recrear el tipo y
    # reescribir la columna. Como esta migración es puramente aditiva y los
    # valores nuevos no se usan en datos previos, el downgrade es un no-op.
    pass
