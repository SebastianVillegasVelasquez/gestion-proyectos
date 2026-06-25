"""Add phase_id, type_label and end_date to project_nodes

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-14 19:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "project_nodes",
        sa.Column("type_label", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "project_nodes",
        sa.Column("phase_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "project_nodes",
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_nodes_phase_id",
        "project_nodes",
        "phases",
        ["phase_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_project_nodes_phase_id", "project_nodes", type_="foreignkey")
    op.drop_column("project_nodes", "end_date")
    op.drop_column("project_nodes", "phase_id")
    op.drop_column("project_nodes", "type_label")
