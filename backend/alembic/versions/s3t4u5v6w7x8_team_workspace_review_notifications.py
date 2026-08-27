"""Team workspace: estado 'rechazado' + preferencias de aviso por equipo

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-08-27

Dos cambios aditivos para las vistas de equipo:

1. `deliverable_status` gana 'rechazado' y `comment_type` gana 'rechazo'. Un
   rechazo no es lo mismo que una solicitud de cambios: la primera cierra la
   entrega tal como esta, la segunda espera otra version del mismo enfoque.
   ALTER TYPE ... ADD VALUE no se puede revertir en Postgres (no existe DROP
   VALUE), asi que el downgrade solo reasigna las filas al estado anterior.

2. Nueva tabla `team_notification_settings`: los avisos se configuran por
   (equipo, usuario) porque la misma persona puede querer distinto nivel de
   ruido en cada equipo. La ausencia de fila significa "todo activado".
"""

import sqlalchemy as sa
from alembic import op

revision = "s3t4u5v6w7x8"
down_revision = "r2s3t4u5v6w7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE no puede compartir la transaccion de la
    # migracion: va en autocommit_block, igual que el resto de enums del repo.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE deliverable_status ADD VALUE IF NOT EXISTS 'rechazado'")
        op.execute("ALTER TYPE comment_type ADD VALUE IF NOT EXISTS 'rechazo'")

    op.create_table(
        "team_notification_settings",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "team_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "nueva_tarea_asignada",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "entregable_rechazado",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "comentario_nuevo", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "entregable_aprobado",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
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
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_notification_setting"),
    )


def downgrade() -> None:
    op.drop_table("team_notification_settings")
    # Postgres no permite quitar un valor de un enum: devolvemos las filas que
    # lo usan al estado/tipo equivalente anterior para que el codigo viejo lea
    # datos validos.
    op.execute(
        "UPDATE team_deliverables SET status = 'cambios_solicitados' "
        "WHERE status = 'rechazado'"
    )
    op.execute(
        "UPDATE deliverable_comments SET comment_type = 'solicitud_cambio' "
        "WHERE comment_type = 'rechazo'"
    )
