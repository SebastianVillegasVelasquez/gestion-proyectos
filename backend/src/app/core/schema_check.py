"""Aviso al arrancar cuando la base de datos se quedó atrás en migraciones.

Sin esto, un esquema desactualizado no se nota al arrancar: se nota más tarde y
peor, con un 500 por cada pantalla que toque una columna que todavía no existe.
Y como el frontend reintenta, parece lentitud en vez de un error de despliegue.

Pasa con facilidad en desarrollo: `uvicorn --reload` recarga el código cuando
cambian los archivos, pero las migraciones solo corren en el arranque del
contenedor (`entrypoint.sh`). Traer código nuevo sin reiniciar deja exactamente
esa mezcla.

Solo avisa, no impide arrancar: dejar la aplicación caída por esto sería peor
que dejarla en marcha con un aviso claro y bien visible en el log.
"""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.logger import get_logger

logger = get_logger(__name__)

# backend/src/app/core/schema_check.py → backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[3]


def _head_revision() -> str | None:
    config = Config(str(_BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_ROOT / "alembic"))
    return ScriptDirectory.from_config(config).get_current_head()


async def warn_if_schema_is_behind(engine: AsyncEngine) -> bool:
    """True si el esquema está al día (o no se pudo comprobar)."""
    try:
        head = _head_revision()
        async with engine.connect() as connection:
            current = await connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
    except Exception:
        # Base recién creada, sin permisos o alembic no disponible: el arranque
        # normal ya migra, así que aquí no hay nada que denunciar.
        logger.debug("No se pudo comprobar el estado del esquema")
        return True

    if head is None or current == head:
        return True

    logger.error(
        "La base de datos NO está migrada: faltan migraciones por aplicar. "
        "Hasta que se apliquen, cualquier pantalla que use lo nuevo fallará "
        "con error 500. Ejecuta `alembic upgrade head` (o reinicia el "
        "contenedor del backend, que lo hace al arrancar).",
        revision_en_base=current,
        revision_esperada=head,
    )
    return False
