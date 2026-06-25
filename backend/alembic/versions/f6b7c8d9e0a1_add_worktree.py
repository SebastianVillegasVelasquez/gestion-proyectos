"""Add worktree bounded context (tipos_nodo, work_items)

Revision ID: f6b7c8d9e0a1
Revises: f5a6b7c8d9e0
Create Date: 2026-06-19

Modelo recursivo de árbol de trabajo (Slice 1). Aditivo: no toca las tablas
existentes (projects, phases, project_nodes, tasks), que conviven hasta la
migración de absorción (slice futuro).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "f6b7c8d9e0a1"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE duracion_unidad AS ENUM ('dias', 'semanas')")

    op.create_table(
        "tipos_nodo",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("proyecto_id", sa.UUID(), nullable=True),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=30), nullable=True),
        sa.Column("icono", sa.String(length=50), nullable=True),
        sa.Column("reglas_anidacion", postgresql.JSONB(), nullable=True),
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
        sa.ForeignKeyConstraint(["proyecto_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "proyecto_id", "nombre", name="uq_tipo_nodo_proyecto_nombre"
        ),
    )
    op.create_index(
        "ix_tipos_nodo_proyecto_id", "tipos_nodo", ["proyecto_id"], unique=False
    )

    op.create_table(
        "work_items",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("proyecto_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("tipo_id", sa.UUID(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prioridad", sa.Integer(), nullable=True),
        sa.Column("fecha_inicio_plan", sa.Date(), nullable=True),
        sa.Column("fecha_fin_plan", sa.Date(), nullable=True),
        sa.Column("duracion_valor", sa.Integer(), nullable=True),
        sa.Column(
            "duracion_unidad",
            postgresql.ENUM(name="duracion_unidad", create_type=False),
            nullable=True,
        ),
        sa.Column("fecha_inicio_real", sa.Date(), nullable=True),
        sa.Column("fecha_fin_real", sa.Date(), nullable=True),
        sa.Column(
            "porcentaje_completado", sa.Numeric(precision=5, scale=4), nullable=True
        ),
        sa.Column(
            "es_transversal", sa.Boolean(), nullable=False, server_default=sa.false()
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["proyecto_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["work_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tipo_id"], ["tipos_nodo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_work_items_proyecto_id", "work_items", ["proyecto_id"], unique=False
    )
    op.create_index(
        "ix_work_items_parent_id", "work_items", ["parent_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_work_items_parent_id", table_name="work_items")
    op.drop_index("ix_work_items_proyecto_id", table_name="work_items")
    op.drop_table("work_items")
    op.drop_index("ix_tipos_nodo_proyecto_id", table_name="tipos_nodo")
    op.drop_table("tipos_nodo")
    op.execute("DROP TYPE duracion_unidad")
