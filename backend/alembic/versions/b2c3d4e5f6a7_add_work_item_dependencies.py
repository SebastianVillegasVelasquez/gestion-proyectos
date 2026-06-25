"""Add work_item_dependencies (FtS sobre el árbol recursivo)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-19

Slice 2: dependencias Finish-to-Start entre WorkItems. Aditivo.
"""

import sqlalchemy as sa
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_item_dependencies",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("work_item_id", sa.UUID(), nullable=False),
        sa.Column("depends_on_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["work_item_id"], ["work_items.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["depends_on_id"], ["work_items.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "work_item_id", "depends_on_id", name="uq_work_item_dependency"
        ),
    )
    op.create_index(
        "ix_work_item_dependencies_work_item_id",
        "work_item_dependencies",
        ["work_item_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_work_item_dependencies_work_item_id",
        table_name="work_item_dependencies",
    )
    op.drop_table("work_item_dependencies")
