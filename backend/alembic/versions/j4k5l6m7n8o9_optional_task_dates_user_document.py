"""Optional task dates + user identity document

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-07-28

Dos cambios independientes:

* ``tasks.start_date`` / ``tasks.due_date`` pasan a ser NULL: una tarea puede
  crearse como borrador (solo título) y planificar sus fechas más tarde.
* ``users`` gana el documento de identidad opcional (``document_type`` +
  ``document_number``). El número es único cuando está presente —una misma
  persona no se registra dos veces— pero admite NULL para quien aún no lo tiene.
"""

import sqlalchemy as sa
from alembic import op

revision = "j4k5l6m7n8o9"
down_revision = "i3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tasks", "start_date", existing_type=sa.Date(), nullable=True)
    op.alter_column("tasks", "due_date", existing_type=sa.Date(), nullable=True)

    op.add_column(
        "users", sa.Column("document_type", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "users", sa.Column("document_number", sa.String(length=32), nullable=True)
    )
    op.create_index(
        "ix_users_document_number",
        "users",
        ["document_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_document_number", table_name="users")
    op.drop_column("users", "document_number")
    op.drop_column("users", "document_type")

    op.alter_column("tasks", "due_date", existing_type=sa.Date(), nullable=False)
    op.alter_column("tasks", "start_date", existing_type=sa.Date(), nullable=False)
