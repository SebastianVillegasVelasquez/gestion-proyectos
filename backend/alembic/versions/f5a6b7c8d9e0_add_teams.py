"""Add teams bounded context (teams, team_members) + project_members.source_team_id

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-17 09:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


team_role = postgresql.ENUM(name="team_role", create_type=False)


def _timestamps() -> list:
    return [
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
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
    ]


def upgrade() -> None:
    op.execute("CREATE TYPE team_role AS ENUM ('lider', 'supervisor', 'integrante')")

    op.create_table(
        "teams",
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_team_name"),
    )

    op.create_table(
        "team_members",
        sa.Column("team_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("team_role", team_role, nullable=False, server_default="integrante"),
        *_timestamps(),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    # Opción A: origen del integrante de proyecto (qué equipo lo aportó).
    op.add_column(
        "project_members", sa.Column("source_team_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_project_members_source_team",
        "project_members",
        "teams",
        ["source_team_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_project_members_source_team", "project_members", type_="foreignkey"
    )
    op.drop_column("project_members", "source_team_id")
    op.drop_table("team_members")
    op.drop_table("teams")
    op.execute("DROP TYPE IF EXISTS team_role")
