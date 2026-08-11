"""Add user_release_views table (what's-new seen tracking per person)

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-08-09

Persiste, por persona, qué novedades ("what's new") ya vio, para que el modal se
muestre una sola vez de verdad (cross-device) y un release nuevo vuelva a contar
como pendiente. Aditivo: tabla nueva con FK a users (ON DELETE CASCADE) y unique
(user_id, release_id).
"""

import sqlalchemy as sa
from alembic import op

revision = "l6m7n8o9p0q1"
down_revision = "k5l6m7n8o9p0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_release_views",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("release_id", sa.String(length=80), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "release_id", name="uq_user_release_view"),
    )
    op.create_index("ix_user_release_views_user_id", "user_release_views", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_release_views_user_id", table_name="user_release_views")
    op.drop_table("user_release_views")
