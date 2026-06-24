"""Add feedback table

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-06-24

Feedback del sitio enviado por los usuarios (bueno, malo, nueva funcionalidad,
nice to have, otro). Persistido para revisarlo de cara al lanzamiento.

El tipo enum `feedback_type` se crea con los NAMES (mayúscula) porque el modelo
usa `Enum(FeedbackType, name=...)` sin `values_callable`, igual que el resto del
esquema (task_status, notification_type).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None

_FEEDBACK_TYPE_VALUES = (
    "POSITIVO",
    "NEGATIVO",
    "NUEVA_FUNCIONALIDAD",
    "NICE_TO_HAVE",
    "OTRO",
)


def upgrade() -> None:
    labels = ", ".join(f"'{value}'" for value in _FEEDBACK_TYPE_VALUES)
    op.execute(f"CREATE TYPE feedback_type AS ENUM ({labels})")

    op.create_table(
        "feedback",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "feedback_type",
            postgresql.ENUM(name="feedback_type", create_type=False),
            nullable=False,
        ),
        sa.Column("page", sa.String(length=300), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_table("feedback")
    op.execute("DROP TYPE feedback_type")
