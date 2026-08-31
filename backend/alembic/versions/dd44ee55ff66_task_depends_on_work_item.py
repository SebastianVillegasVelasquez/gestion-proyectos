"""Una tarea puede depender de un elemento del árbol

Revision ID: dd44ee55ff66
Revises: cc33dd44ee55
Create Date: 2026-08-31

`task_dependencies` deja de ser tarea→tarea exclusivamente: `depends_on_id`
pasa a ser opcional y se añade `depends_on_work_item_id` para que una tarea
pueda depender de un WorkItem (típico: una «actividad de terceros», o
cualquier módulo/unidad del que cuelga trabajo). Un CHECK exige que vaya
relleno exactamente uno de los dos.
"""

import sqlalchemy as sa
from alembic import op

revision = "dd44ee55ff66"
down_revision = "cc33dd44ee55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("task_dependencies", "depends_on_id", nullable=True)
    op.add_column(
        "task_dependencies",
        sa.Column(
            "depends_on_work_item_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("work_items.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_unique_constraint(
        "uq_task_dep_work_item",
        "task_dependencies",
        ["task_id", "depends_on_work_item_id"],
    )
    op.create_check_constraint(
        "ck_task_dep_one_target",
        "task_dependencies",
        "(depends_on_id IS NOT NULL)::int "
        "+ (depends_on_work_item_id IS NOT NULL)::int = 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_task_dep_one_target", "task_dependencies")
    op.drop_constraint("uq_task_dep_work_item", "task_dependencies", type_="unique")
    op.drop_column("task_dependencies", "depends_on_work_item_id")
    op.execute("DELETE FROM task_dependencies WHERE depends_on_id IS NULL")
    op.alter_column("task_dependencies", "depends_on_id", nullable=False)
