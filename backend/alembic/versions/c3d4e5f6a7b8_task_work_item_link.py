"""Add tasks.work_item_id (convergencia: las tareas cuelgan del árbol flexible)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-19

Aditivo: agrega el enlace de Task → WorkItem. node_id/phase_id se conservan
durante la transición; se retiran en el paso final de la convergencia.
"""

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("work_item_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_work_item_id",
        "tasks",
        "work_items",
        ["work_item_id"],
        ["id"],
    )
    op.create_index("ix_tasks_work_item_id", "tasks", ["work_item_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tasks_work_item_id", table_name="tasks")
    op.drop_constraint("fk_tasks_work_item_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "work_item_id")
