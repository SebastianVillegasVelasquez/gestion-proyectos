"""Invitaciones a equipos (fase 5)

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-08-28

Un líder invita a un integrante del proyecto a su equipo; la persona no entra
como `team_member` hasta que acepta. Tabla nueva y aislada + su enum de estado.
Una fila por (equipo, usuario): reinvitar tras rechazo reutiliza la fila.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "v6w7x8y9z0a1"
down_revision = "u5v6w7x8y9z0"
branch_labels = None
depends_on = None

# create_type=False: la creamos explícitamente con op.execute (patrón del repo).
invitation_status = postgresql.ENUM(name="invitation_status", create_type=False)


def upgrade() -> None:
    op.execute(
        "CREATE TYPE invitation_status AS ENUM "
        "('pendiente', 'aceptada', 'rechazada')"
    )

    op.create_table(
        "team_invitations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
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
        sa.Column(
            "team_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "status",
            invitation_status,
            nullable=False,
            server_default="pendiente",
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_invitation"),
    )
    op.create_index("ix_team_invitations_user_id", "team_invitations", ["user_id"])
    op.create_index("ix_team_invitations_team_id", "team_invitations", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_team_invitations_team_id", table_name="team_invitations")
    op.drop_index("ix_team_invitations_user_id", table_name="team_invitations")
    op.drop_table("team_invitations")
    op.execute("DROP TYPE invitation_status")
