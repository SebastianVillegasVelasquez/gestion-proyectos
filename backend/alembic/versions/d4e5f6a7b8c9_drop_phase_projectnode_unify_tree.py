"""Drop phases/project_nodes — la estructura del proyecto vive en work_items

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-19

Paso final de la convergencia. project deja de tener dos modelos estructurales
(Phase + ProjectNode) y pasa a UN solo modelo recursivo (WorkItem) que ya
conviven en el esquema. Las tareas cuelgan directo del árbol flexible.

Estrategia: como los datos actuales son seed (no producción), se borran las
tareas y la estructura vieja en lugar de migrar fila por fila — los seeders
de la siguiente ronda generan TipoNodo + WorkItem y tareas con work_item_id.
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Limpieza de datos: las tareas viejas cuelgan de node/phase; las nuevas
    # cuelgan de work_item. Como son datos de seed, los re-creamos vacíos.
    op.execute(
        "TRUNCATE TABLE task_dependencies, task_history, tasks RESTART IDENTITY CASCADE"
    )
    op.execute("TRUNCATE TABLE project_nodes, phases RESTART IDENTITY CASCADE")

    # FKs y columnas obsoletas de tasks. El nombre de la FK de phase varía
    # según versiones — usamos IF EXISTS para tolerarlo.
    op.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_node_id_fkey")
    op.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_phase_id_fkey")
    op.execute("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_phase_id")
    op.drop_column("tasks", "node_id")
    op.drop_column("tasks", "phase_id")

    # Ahora la tarea SIEMPRE cuelga del árbol → not null.
    op.alter_column("tasks", "work_item_id", nullable=False)

    # Tablas y enum del modelo viejo.
    op.drop_table("project_nodes")
    op.drop_table("phases")
    op.execute("DROP TYPE IF EXISTS nodetype")


def downgrade() -> None:
    # Bajada parcial: recrea las tablas y columnas vacías (los datos se perdieron
    # en el upgrade por diseño).
    op.execute("CREATE TYPE nodetype AS ENUM ('PROGRAMA', 'CURSO', 'MODULO')")
    op.create_table(
        "phases",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("project_id", sa.UUID(), nullable=False),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "project_nodes",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "node_type",
            sa.Enum("PROGRAMA", "CURSO", "MODULO", name="nodetype"),
            nullable=False,
        ),
        sa.Column("type_label", sa.String(length=50), nullable=True),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("phase_id", sa.UUID(), nullable=True),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["phase_id"], ["phases.id"]),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["project_nodes.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.alter_column("tasks", "work_item_id", nullable=True)
    op.add_column("tasks", sa.Column("node_id", sa.UUID(), nullable=True))
    op.add_column("tasks", sa.Column("phase_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "tasks_node_id_fkey", "tasks", "project_nodes", ["node_id"], ["id"]
    )
    op.create_foreign_key(
        "tasks_phase_id_fkey", "tasks", "phases", ["phase_id"], ["id"]
    )
