"""Add project_incidents and incident_attachments

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-11-04

Bitácora de incidentes contractuales por proyecto. Aditivo: dos tablas nuevas
(el incidente y su evidencia) y un enum; no toca datos existentes. `applied_days`
/ `applied_at` registran cuánto se reflejó en la fecha de fin del proyecto.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

_responsible = postgresql.ENUM(
    "cliente", "equipo", "tercero", name="incident_responsible", create_type=False
)


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    _responsible.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "project_incidents",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", sa.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("email_body", sa.Text(), nullable=True),
        sa.Column("responsible", _responsible, nullable=False),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column("impact_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("client_response_date", sa.Date(), nullable=True),
        sa.Column("applied_days", sa.Integer(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("impact_days >= 0", name="ck_project_incidents_impact_days"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_incidents_project_id", "project_incidents", ["project_id"]
    )

    op.create_table(
        "incident_attachments",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("incident_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("content_type", sa.String(150), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("uploaded_by", sa.UUID(as_uuid=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["incident_id"], ["project_incidents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_incident_attachments_incident_id", "incident_attachments", ["incident_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_incident_attachments_incident_id", table_name="incident_attachments"
    )
    op.drop_table("incident_attachments")
    op.drop_index("ix_project_incidents_project_id", table_name="project_incidents")
    op.drop_table("project_incidents")
    _responsible.drop(op.get_bind(), checkfirst=True)
