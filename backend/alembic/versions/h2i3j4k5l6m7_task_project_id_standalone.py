"""Allow standalone tasks: add tasks.project_id, make tasks.work_item_id nullable

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-07-25

Una tarea ahora puede crearse suelta (sin estructura todavía) y adjuntarse
después a un WorkItem. Para eso necesita una referencia estable al proyecto
que no dependa de tener un work_item_id. Se agrega `project_id` (backfilleado
desde el work_item existente de cada tarea) y se libera `work_item_id` a
nullable.
"""

import sqlalchemy as sa
from alembic import op

revision = "h2i3j4k5l6m7"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks", sa.Column("project_id", sa.UUID(as_uuid=True), nullable=True)
    )

    # Backfill: toda tarea existente cuelga de un work_item, así que su
    # proyecto se deriva de ahí.
    op.execute(
        """
        UPDATE tasks
        SET project_id = work_items.proyecto_id
        FROM work_items
        WHERE tasks.work_item_id = work_items.id
        """
    )

    op.alter_column(
        "tasks", "project_id", existing_type=sa.UUID(as_uuid=True), nullable=False
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_foreign_key(
        "fk_tasks_project_id_projects",
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.alter_column(
        "tasks", "work_item_id", existing_type=sa.UUID(as_uuid=True), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "tasks", "work_item_id", existing_type=sa.UUID(as_uuid=True), nullable=False
    )
    op.drop_constraint("fk_tasks_project_id_projects", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_project_id", table_name="tasks")
    op.drop_column("tasks", "project_id")
