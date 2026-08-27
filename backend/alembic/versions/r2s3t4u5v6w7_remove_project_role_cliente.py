"""Remove CLIENTE project role (existing members become INTEGRANTE)

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-08-26

El cliente no tiene cuenta en el sistema: ve el avance por el portal público
(/portal/{token}), sin login. Mantener un rol de proyecto "cliente" era una
segunda puerta para el mismo caso de uso, así que se retira del enum.

Postgres no permite quitar un valor de un enum in-place: se renombra el tipo
viejo, se crea el nuevo sin CLIENTE y se castea la columna.
"""

from alembic import op

revision = "r2s3t4u5v6w7"
down_revision = "q1r2s3t4u5v6"
branch_labels = None
depends_on = None

# SQLAlchemy persiste el NAME del enum (mayúsculas) para `projectrole`.
_NEW_VALUES = "'SUPERVISOR', 'COORDINADOR', 'REVISOR', 'INTEGRANTE'"
_OLD_VALUES = "'SUPERVISOR', 'COORDINADOR', 'REVISOR', 'INTEGRANTE', 'CLIENTE'"


def _recreate_project_role(new_values: str) -> None:
    """Recrea el tipo enum `projectrole` con el conjunto de valores dado.

    `project_members.project_role` no tiene default de servidor (el default se
    aplica en Python), así que basta recrear el tipo y castear la columna.
    """
    op.execute("ALTER TYPE projectrole RENAME TO projectrole_old")
    op.execute(f"CREATE TYPE projectrole AS ENUM ({new_values})")
    op.execute(
        "ALTER TABLE project_members ALTER COLUMN project_role TYPE projectrole "
        "USING project_role::text::projectrole"
    )
    op.execute("DROP TYPE projectrole_old")


def upgrade() -> None:
    # 1) Quien estuviera como cliente pasa a integrante (no se le expulsa del
    #    proyecto: es el rol más restringido que sigue existiendo).
    op.execute(
        "UPDATE project_members SET project_role = 'INTEGRANTE' "
        "WHERE project_role = 'CLIENTE'"
    )
    # 2) Enum sin CLIENTE.
    _recreate_project_role(_NEW_VALUES)


def downgrade() -> None:
    # Reintroduce el valor; los miembros ya reasignados se quedan como
    # INTEGRANTE (el dato original no se puede reconstruir).
    _recreate_project_role(_OLD_VALUES)
