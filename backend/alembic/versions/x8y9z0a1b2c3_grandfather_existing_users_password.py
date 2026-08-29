"""Los usuarios existentes NO deben cambiar la contraseña

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-08-29

`must_change_password` se introdujo con default en la aplicación y, en un punto
intermedio, con default True. Eso dejó marcadas cuentas que ya existían (seeds,
usuarios reales de producción y del entorno local) obligándolas a pasar por el
modal de "primer ingreso" aunque su contraseña sea legítima.

Esta migración normaliza el estado: TODAS las filas actuales quedan en False.
Es seguro porque la funcionalidad aún no está en producción, así que a esta
altura no existe ninguna cuenta que *deba* estar forzada. A partir de aquí el
flag solo lo pone en True el alta de usuario por un admin (`UserService.create_user`,
que dispara el correo de bienvenida) y el reset de contraseña.
"""

from alembic import op

revision = "x8y9z0a1b2c3"
down_revision = "w7x8y9z0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET must_change_password = false")


def downgrade() -> None:
    # Sin vuelta atrás: no hay forma de reconstruir qué filas estaban forzadas.
    pass
