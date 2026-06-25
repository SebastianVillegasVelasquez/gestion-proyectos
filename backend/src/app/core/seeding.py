"""Punto ÚNICO de siembra de datos al arrancar.

Desacopla del `main` toda la decisión de "qué se carga y cuándo". El `main` solo
llama `run_seed()`; la lógica de entorno vive aquí:

- Desarrollo: datos de demostración (para ver la app con contenido real).
- Producción: el equipo real de OBJ Digital (developer + administradores).

Los usuarios base (super admin, developer) se intentan en ambos entornos, pero
solo se crean si su contraseña está definida en el entorno.
"""

from app.core.config import get_settings
from app.core.logger import get_logger
from app.core.seed import ensure_developer, ensure_super_admin, ensure_team_users
from app.core.seed_demo import ensure_demo_data, ensure_demo_traceability

logger = get_logger(__name__)


async def run_seed() -> None:
    settings = get_settings()

    # Usuarios técnicos/base (guardados por su contraseña en el entorno).
    await ensure_super_admin()
    await ensure_developer()

    if settings.IS_DEV:
        logger.info("Seed: entorno de desarrollo → datos de demostración")
        await ensure_demo_data()
        await ensure_demo_traceability()
    else:
        logger.info("Seed: entorno de producción → equipo de OBJ Digital")
        await ensure_team_users()
