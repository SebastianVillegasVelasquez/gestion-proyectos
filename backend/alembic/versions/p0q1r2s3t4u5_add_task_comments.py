"""Add task comments with mentions

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-08-26

La conversación de una tarea vive junto al trabajo, no en un chat aparte: quien
llega tarde necesita leer por qué se decidió lo que se decidió.

Las menciones son filas propias (`task_comment_mentions`) y no un parseo del
texto: a quién se avisó es un hecho del pasado, y editar el cuerpo del
comentario no debe cambiarlo ni volver a notificar. Aditivo: dos tablas nuevas
con FK en cascada.
"""

import sqlalchemy as sa
from alembic import op

revision = "p0q1r2s3t4u5"
down_revision = "o9p0q1r2s3t4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_comments",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("task_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_comments_task_id", "task_comments", ["task_id"])

    op.create_table(
        "task_comment_mentions",
        sa.Column(
            "id",
            sa.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("comment_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["comment_id"], ["task_comments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_comment_mention"),
    )
    op.create_index(
        "ix_task_comment_mentions_comment_id", "task_comment_mentions", ["comment_id"]
    )
    op.create_index(
        "ix_task_comment_mentions_user_id", "task_comment_mentions", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_task_comment_mentions_user_id", table_name="task_comment_mentions"
    )
    op.drop_index(
        "ix_task_comment_mentions_comment_id", table_name="task_comment_mentions"
    )
    op.drop_table("task_comment_mentions")
    op.drop_index("ix_task_comments_task_id", table_name="task_comments")
    op.drop_table("task_comments")
