"""Make teams project-scoped: add teams.project_id, drop global name uniqueness

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-07-26

Los equipos de trabajo dejan de ser un catálogo global y pasan a vivir
dentro de un proyecto. No hay datos reales que migrar (entorno de
desarrollo), así que se vacían equipos y todo lo que depende de ellos
(integrantes y entregables del workspace) antes de agregar la columna
`project_id` como NOT NULL.
"""

import sqlalchemy as sa
from alembic import op

revision = "i3j4k5l6m7n8"
down_revision = "h2i3j4k5l6m7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "TRUNCATE TABLE team_deliverables, deliverable_versions, "
        "deliverable_comments, team_members, teams RESTART IDENTITY CASCADE"
    )

    op.add_column(
        "teams", sa.Column("project_id", sa.UUID(as_uuid=True), nullable=False)
    )
    op.create_index("ix_teams_project_id", "teams", ["project_id"])
    op.create_foreign_key(
        "fk_teams_project_id_projects",
        "teams",
        "projects",
        ["project_id"],
        ["id"],
    )

    op.drop_constraint("uq_team_name", "teams", type_="unique")
    op.create_unique_constraint(
        "uq_team_name_per_project", "teams", ["project_id", "name"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_team_name_per_project", "teams", type_="unique")
    op.create_unique_constraint("uq_team_name", "teams", ["name"])
    op.drop_constraint("fk_teams_project_id_projects", "teams", type_="foreignkey")
    op.drop_index("ix_teams_project_id", table_name="teams")
    op.drop_column("teams", "project_id")
