"""La carpeta de primer nivel puede ser de una PERSONA, no solo de un equipo.

Una tarea individual no tiene equipo, así que su entrega no tenía dónde caer
dentro del archivador del proyecto y el material se quedaba fuera de la
herramienta. Con `user_id` el primer nivel admite un segundo tipo de dueño:
la carpeta de una persona, con sus entregas individuales de ese proyecto.

La visibilidad sigue la misma regla que la carpeta de un equipo —la ve su
dueño, y quien mira el proyecto entero (administración, coordinación,
supervisión)—, así que no hace falta ninguna otra columna.

Índice parcial `uq_project_folders_user_alive`: una carpeta viva por persona y
proyecto, en espejo del que ya existe para los equipos.

Revision ID: 4d1a97be0c35
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "4d1a97be0c35"
down_revision = "2b9e46c17a08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_folders",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_folders_user",
        "project_folders",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "uq_project_folders_user_alive",
        "project_folders",
        ["project_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_project_folders_user_alive", table_name="project_folders")
    op.drop_constraint("fk_project_folders_user", "project_folders", type_="foreignkey")
    op.drop_column("project_folders", "user_id")
