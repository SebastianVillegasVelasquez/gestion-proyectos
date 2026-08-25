from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.exceptions import EntityNotSavedError

T = TypeVar("T")


class Repository(Generic[T], ABC):
    """Contrato base para todos los repositorios del dominio.

    Cada módulo implementa esta interfaz en su capa de infraestructura
    con SQLAlchemy. Esto permite inyectar mocks en tests unitarios.
    """

    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> T | None: ...

    @abstractmethod
    async def save(self, entity: T) -> T: ...

    @abstractmethod
    async def get_all(self) -> list[T]: ...

    @abstractmethod
    async def update(self, entity: T) -> T: ...  # noqa: F821

    @abstractmethod
    async def add(self, entity: T) -> T: ...

    @abstractmethod
    async def patch(self, entity: T, data: dict[str, Any]) -> T: ...


class BaseRepository(Repository[T], Generic[T]):
    def __init__(self, model: type[T], session: AsyncSession) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, entity_id: UUID) -> T | None:
        return await self._session.get(self._model, entity_id)

    async def get_all(self) -> list[T]:
        # Los modelos concretos incluyen SoftDeleteMixin (deleted_at); T es genérico
        # y mypy no puede saberlo aquí.
        query = select(self._model).where(self._model.deleted_at.is_(None))  # type: ignore[attr-defined]
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def save(self, entity: T) -> T:
        try:
            self._session.add(entity)

            await self._session.flush()
            await self._session.refresh(entity)

            return entity

        except Exception as e:
            raise EntityNotSavedError("Error al guardar el registro: " + str(e)) from e

    async def add(self, entity: T) -> T:
        return await self.save(entity)

    async def rollback(self) -> None:
        """Descarta la transacción actual tras un fallo inesperado en `save`.

        Necesario para callers que siguen usando la misma sesión después de un
        error (p. ej. procesamiento fila a fila de un CSV): sin rollback, la
        sesión queda en estado "aborted" y toda operación posterior también
        fallaría, aunque sea sobre datos válidos.
        """
        await self._session.rollback()

    async def update(self, entity: T) -> T:
        return await self.save(entity)

    async def patch(self, entity: T, data: dict[str, Any]) -> T:
        for field, value in data.items():
            if value is not None:
                setattr(entity, field, value)

        return await self.save(entity)
