from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from uuid import UUID

T = TypeVar("T")


class IRepository(ABC, Generic[T]):
    """Contrato base para todos los repositorios del dominio.

    Cada módulo implementa esta interfaz en su capa de infraestructura
    con SQLAlchemy. Esto permite inyectar mocks en tests unitarios.
    """

    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> T | None: ...

    @abstractmethod
    async def save(self, entity: T) -> T: ...

    @abstractmethod
    async def delete(self, entity_id: UUID) -> None: ...
