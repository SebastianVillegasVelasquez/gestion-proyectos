"""Remove CLIENT system role (migrate existing clients to USER)

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-08-09

Se elimina el rol de sistema CLIENT: el portal del cliente es público (por token)
y no necesita cuentas con ese rol. Primero se reasignan los usuarios existentes
con rol CLIENT a USER; luego se recrea el tipo enum `user_role` sin ese valor
(Postgres no permite quitar un valor de un enum in-place, así que se renombra el
tipo viejo, se crea el nuevo y se migra la columna).
"""

from alembic import op

revision = "m7n8o9p0q1r2"
down_revision = "l6m7n8o9p0q1"
branch_labels = None
depends_on = None

# Los valores se guardan con el NAME del enum (mayúsculas), como hace SQLAlchemy.
_NEW_VALUES = "'DEVELOPER', 'SUPER_ADMIN', 'ADMIN', 'USER'"
_OLD_VALUES = "'DEVELOPER', 'SUPER_ADMIN', 'ADMIN', 'USER', 'CLIENT'"


def _recreate_user_role(new_values: str) -> None:
    """Recrea el tipo enum `user_role` con el conjunto de valores dado.

    La columna `users.role` no tiene default a nivel de servidor (el default se
    aplica en Python), así que basta con recrear el tipo y castear la columna.
    """
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute(f"CREATE TYPE user_role AS ENUM ({new_values})")
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE user_role "
        "USING role::text::user_role"
    )
    op.execute("DROP TYPE user_role_old")


def upgrade() -> None:
    # 1) Todo cliente pasa a usuario estándar antes de retirar el valor del enum.
    op.execute("UPDATE users SET role = 'USER' WHERE role = 'CLIENT'")
    # 2) Enum sin CLIENT.
    _recreate_user_role(_NEW_VALUES)


def downgrade() -> None:
    # Reintroduce el valor CLIENT en el enum (los usuarios ya migrados se quedan
    # como USER: la reasignación de datos no es reversible sin información previa).
    _recreate_user_role(_OLD_VALUES)
