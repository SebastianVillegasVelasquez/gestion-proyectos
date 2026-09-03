"""Fusiona las dos cabezas vivas: cargos ampliados y archivador de proyecto.

Las dos ramas tocan tablas distintas (`users.position` por un lado, el
archivador y el muro de perfil por otro), así que la fusión no tiene nada que
resolver: existe solo para que Alembic vuelva a tener UNA cabeza. Sin ella
`alembic upgrade head` falla con "Multiple head revisions are present" y NO
aplica ninguna migración, ni siquiera las que sí podría.

Revision ID: 1f7c3ab54d92
"""

revision = "1f7c3ab54d92"
down_revision = ("n2o3p4q5r6s7", "a7b8c9d0e1f2")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
