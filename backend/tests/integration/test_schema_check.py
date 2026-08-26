"""Aviso de esquema atrasado.

Una base sin migrar no se nota al arrancar: se nota pantalla por pantalla, en
forma de 500 y de lentitud (el frontend reintenta). Esta comprobación lo dice
en el arranque, con las dos revisiones a la vista.
"""

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.core.schema_check import warn_if_schema_is_behind


@pytest_asyncio.fixture
async def async_engine(db_session):
    """Motor async contra la base de test (ya migrada por la sesión de tests)."""
    engine = create_async_engine(get_settings().DATABASE_URL)
    yield engine
    await engine.dispose()


class TestSchemaCheck:
    async def test_says_ok_when_the_database_is_up_to_date(self, async_engine):
        assert await warn_if_schema_is_behind(async_engine) is True

    async def test_warns_when_the_database_is_behind(self, async_engine):
        """Simula el caso real: código nuevo contra una base que se quedó en la
        revisión anterior (recargar con --reload no vuelve a migrar)."""
        engine = async_engine
        async with engine.begin() as connection:
            current = await connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
            await connection.execute(
                text("UPDATE alembic_version SET version_num = 'revision_vieja'")
            )
        try:
            # False = "no está al día": es lo que dispara el aviso en el log.
            assert await warn_if_schema_is_behind(engine) is False
        finally:
            async with engine.begin() as connection:
                await connection.execute(
                    text("UPDATE alembic_version SET version_num = :v"),
                    {"v": current},
                )

    async def test_does_not_break_startup_when_it_cannot_check(self):
        """Sin base accesible, arrancar sigue siendo asunto de otros: aquí se
        calla y devuelve que todo está bien."""
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(
            "postgresql+asyncpg://nadie:nada@localhost:1/no_existe"
        )
        try:
            assert await warn_if_schema_is_behind(engine) is True
        finally:
            await engine.dispose()


@pytest.mark.usefixtures("db_session")
class TestNoRegression:
    """Recordatorio: si esta prueba falla tras añadir una migración, es que la
    base de test no se está migrando, no que la comprobación esté mal."""

    async def test_head_is_reachable(self):
        from app.core.schema_check import _head_revision

        assert _head_revision() is not None
