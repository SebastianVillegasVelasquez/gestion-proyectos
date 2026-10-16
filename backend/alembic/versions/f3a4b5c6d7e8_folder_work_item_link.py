"""Link archive folders to structure elements

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-10-16

`project_folders.work_item_id` marks a folder generated from a structure
element. Those folders are shared by every team of the project (they have no
team or person owner) and mirror the element hierarchy.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_folders",
        sa.Column(
            "work_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("work_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # One live folder per element: generating twice must reuse, not duplicate.
    op.create_index(
        "uq_project_folders_work_item_alive",
        "project_folders",
        ["project_id", "work_item_id"],
        unique=True,
        postgresql_where=sa.text("work_item_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_project_folders_work_item_alive", table_name="project_folders")
    op.drop_column("project_folders", "work_item_id")
