"""Link project files to the task they support

Revision ID: d1e2f3a4b5c6
Revises: c7d8e9f0a1b2
Create Date: 2026-10-14

`project_files.task_id` es el eslabón de trazabilidad archivo <-> tarea: sin él
un archivo solo se sabía "del equipo", no "de qué trabajo". Se rellena para los
archivos que ya llegaron por una entrega.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d1e2f3a4b5c6"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_files",
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_project_files_task_id", "project_files", ["task_id"])

    # Backfill: un archivo entregado en el entregable de una tarea ya es
    # "de esa tarea". Se toma la tarea del entregable al que pertenece su versión.
    op.execute(
        """
        UPDATE project_files pf
        SET task_id = d.task_id
        FROM deliverable_versions dv
        JOIN team_deliverables d ON d.id = dv.deliverable_id
        WHERE dv.file_id = pf.id
          AND d.task_id IS NOT NULL
          AND pf.task_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_project_files_task_id", table_name="project_files")
    op.drop_column("project_files", "task_id")
