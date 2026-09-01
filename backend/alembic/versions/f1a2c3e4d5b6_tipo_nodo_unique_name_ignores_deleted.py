"""Tipo de nodo: el nombre único ignora los tipos borrados

Revision ID: f1a2c3e4d5b6
Revises: ff6677889900
Create Date: 2026-08-31

`uq_tipo_nodo_proyecto_nombre` era una UNIQUE plena sobre (proyecto_id, nombre),
pero el borrado de tipos es lógico (deleted_at) y la fila se queda. Al volver a
crear un tipo con el nombre de uno borrado, el pre-check (que sí ignora los
borrados) daba vía libre y el INSERT chocaba con la constraint → IntegrityError
500, y sin poder reutilizar nunca ese nombre.

Se cambia por un índice único PARCIAL: la unicidad solo aplica entre tipos
vivos (`deleted_at IS NULL`).
"""

from alembic import op

revision = "f1a2c3e4d5b6"
down_revision = "ff6677889900"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_tipo_nodo_proyecto_nombre", "tipos_nodo", type_="unique")
    op.create_index(
        "uq_tipo_nodo_proyecto_nombre",
        "tipos_nodo",
        ["proyecto_id", "nombre"],
        unique=True,
        postgresql_where="deleted_at IS NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_tipo_nodo_proyecto_nombre", table_name="tipos_nodo")
    op.create_unique_constraint(
        "uq_tipo_nodo_proyecto_nombre", "tipos_nodo", ["proyecto_id", "nombre"]
    )
