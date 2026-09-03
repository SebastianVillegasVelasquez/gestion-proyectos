"""Una entrega puede ser un ARCHIVO del archivador del proyecto.

Hasta ahora una versión de entregable solo podía apuntar a una URL externa (o
a nada). Con `file_id` puede apuntar a un archivo real, que se guarda en la
carpeta del equipo dentro del proyecto: el material entregado deja de vivir
fuera de la herramienta.

`ondelete="SET NULL"`: borrar el archivo de la carpeta no debe borrar la
entrega —su nota, su número de versión y su revisión siguen siendo historia—,
solo deja de haber material que abrir.

Revision ID: c2d3e4f5a6b7
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "deliverable_versions",
        sa.Column("file_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_deliverable_versions_file",
        "deliverable_versions",
        "project_files",
        ["file_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_deliverable_versions_file", "deliverable_versions", type_="foreignkey"
    )
    op.drop_column("deliverable_versions", "file_id")
