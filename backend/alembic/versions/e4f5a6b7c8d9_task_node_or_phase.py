"""Allow a task to attach to a node OR a phase

Makes tasks.node_id nullable and adds an optional tasks.phase_id FK so a task
can belong to a module/curso (node) or directly to a phase.

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-15 16:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("tasks", "node_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("tasks", sa.Column("phase_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_tasks_phase_id", "tasks", "phases", ["phase_id"], ["id"])
    op.create_index(op.f("ix_tasks_phase_id"), "tasks", ["phase_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_phase_id"), table_name="tasks")
    op.drop_constraint("fk_tasks_phase_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "phase_id")
    op.alter_column("tasks", "node_id", existing_type=sa.UUID(), nullable=False)
