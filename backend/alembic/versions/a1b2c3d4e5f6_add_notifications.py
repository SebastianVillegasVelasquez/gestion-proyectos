"""Add notifications table (faltaba la migración del modelo Notification)

Revision ID: a1b2c3d4e5f6
Revises: f6b7c8d9e0a1
Create Date: 2026-06-19

El módulo de notifications registraba el modelo y disparaba el handler en cada
asignación de miembro, pero nunca tuvo migración: la tabla no existía en ninguna
BD armada solo desde migraciones (tests/deploy). Esta migración la crea.

El tipo enum `notification_type` se crea con los NAMES (mayúscula) porque el
modelo usa `Enum(NotificationType, name=...)` sin `values_callable`, igual que
`projectrole`/`task_status` en el resto del esquema.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f6b7c8d9e0a1"
branch_labels = None
depends_on = None

_NOTIFICATION_TYPE_VALUES = (
    "TAREA_ASIGNADA",
    "TAREA_ENTREGADA",
    "TAREA_RECHAZADA",
    "TAREA_ATRASADA",
    "PROYECTO_MIEMBRO_AGREGADO",
    "PROYECTO_CERRADO",
    "PROYECTO_INICIADO",
    "PROYECTO_PAUSADO",
    "PROYECTO_FINALIZADO",
    "COMENTARIO_PUBLICADO",
    "COMENTARIO_RESPUESTA",
    "MENCION",
)


def upgrade() -> None:
    labels = ", ".join(f"'{value}'" for value in _NOTIFICATION_TYPE_VALUES)
    op.execute(f"CREATE TYPE notification_type AS ENUM ({labels})")

    op.create_table(
        "notifications",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("user_to_id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column(
            "notification_type",
            postgresql.ENUM(name="notification_type", create_type=False),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_to_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notifications_user_to_id", "notifications", ["user_to_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_to_id", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE notification_type")
