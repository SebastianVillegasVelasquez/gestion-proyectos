"""Recordatorios personales + notificación 'recordatorio'

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-08-28

Feature nueva y aislada: cada persona se programa avisos ("llamar al cliente
el martes"). Un worker los despacha por notificación in-app y/o correo cuando
llega la hora.

1. `notification_type` gana el valor 'recordatorio' (ADD VALUE no es
   reversible en Postgres; el downgrade solo reasigna las filas).
2. Nueva tabla `personal_reminders` con dos enums propios
   (`reminder_channel`, `reminder_status`).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "t4u5v6w7x8y9"
down_revision = "s3t4u5v6w7x8"
branch_labels = None
depends_on = None

# create_type=False: los tipos se crean/borran explícitamente abajo, no al
# vuelo dentro de create_table (si no, se emite CREATE TYPE dos veces).
reminder_channel = postgresql.ENUM(
    "notificacion", "correo", "ambos", name="reminder_channel", create_type=False
)
reminder_status = postgresql.ENUM(
    "pendiente", "enviado", "cancelado", name="reminder_status", create_type=False
)


def upgrade() -> None:
    # `notifications.notification_type` usa los NOMBRES del enum de Python como
    # labels (MAYÚSCULAS), a diferencia de otros enums del repo que guardan el
    # value. Por eso el label nuevo es 'RECORDATORIO', no 'recordatorio'.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'RECORDATORIO'"
        )

    op.execute(
        "CREATE TYPE reminder_channel AS ENUM ('notificacion', 'correo', 'ambos')"
    )
    op.execute(
        "CREATE TYPE reminder_status AS ENUM ('pendiente', 'enviado', 'cancelado')"
    )

    op.create_table(
        "personal_reminders",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "channel",
            reminder_channel,
            nullable=False,
            server_default="notificacion",
        ),
        sa.Column(
            "status",
            reminder_status,
            nullable=False,
            server_default="pendiente",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_personal_reminders_user_id", "personal_reminders", ["user_id"])
    op.create_index(
        "ix_personal_reminders_remind_at", "personal_reminders", ["remind_at"]
    )
    op.create_index("ix_personal_reminders_status", "personal_reminders", ["status"])


def downgrade() -> None:
    op.drop_index("ix_personal_reminders_status", table_name="personal_reminders")
    op.drop_index("ix_personal_reminders_remind_at", table_name="personal_reminders")
    op.drop_index("ix_personal_reminders_user_id", table_name="personal_reminders")
    op.drop_table("personal_reminders")
    op.execute("DROP TYPE IF EXISTS reminder_status")
    op.execute("DROP TYPE IF EXISTS reminder_channel")
    # Postgres no permite quitar un valor de enum: las notificaciones
    # 'recordatorio' se reasignan a un tipo genérico para no romper el ORM.
    op.execute(
        "UPDATE notifications SET notification_type = 'MENCION' "
        "WHERE notification_type = 'RECORDATORIO'"
    )
