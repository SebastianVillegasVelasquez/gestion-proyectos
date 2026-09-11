"""Add client schedule scope to projects

Revision ID: c7d8e9f0a1b2
Revises: p1q2r3s4t5u6
Create Date: 2026-09-10

Recorte configurable del cronograma que ve el cliente en el portal público:
hasta qué profundidad de la estructura se dibuja y si se incluyen las tareas y
subtareas de cada elemento. Aditivo: tres columnas NOT NULL con server_default,
sin backfill (los proyectos existentes quedan en "todos los elementos, sin
tareas", el comportamiento previo).
"""

import sqlalchemy as sa
from alembic import op

revision = "c7d8e9f0a1b2"
down_revision = "p1q2r3s4t5u6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "client_schedule_element_depth",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "client_schedule_include_tasks",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "client_schedule_include_subtasks",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "client_schedule_include_subtasks")
    op.drop_column("projects", "client_schedule_include_tasks")
    op.drop_column("projects", "client_schedule_element_depth")
