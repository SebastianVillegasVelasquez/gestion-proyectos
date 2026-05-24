from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class Repository(ABC, Generic[T]):
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
    async def update(self, entity: T) -> T: ...


class BaseRepository(Repository[T]):
    """Implementación base de Repository con métodos comunes.

    Cada módulo puede extender esta clase para evitar repetir código
    común entre repositorios.

    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.entity = type[T]

    async def get_by_id(self, entity_id: UUID) -> T | None:
        # Implementación común para obtener por ID
        try:
            result = await self.session.get(self.entity, entity_id)
            return result
        except Exception as e:
            print(f"Error al obtener el usuario por ID: {e}")
            return None

    async def save(self, entity: T) -> T:
        # Implementación común para guardar una entidad
        try:
            self.session.add(entity)
            await self.session.commit()
            return entity
        except Exception as e:
            print(f"Error al guardar la entidad: {e}")
            await self.session.rollback()
            raise

    async def get_all(self) -> list[T]:
        # Implementación común para obtener todas las entidades
        query = select(self.entity)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, entity: T) -> T:
        # Implementación común para actualizar una entidad
        self.session.merge(entity)
        await self.session.commit()
        return entity
