from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
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


class BaseRepository(Repository[T], Generic[T]):
    def __init__(self, model: type[T], session: AsyncSession) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, entity_id: UUID) -> T | None:
        return await self._session.get(self._model, entity_id)

    async def get_all(self) -> list[T]:
        query = select(self._model)

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

    async def update(self, entity: T) -> T:
        return await self.save(entity)

    async def patch(self, entity: T, data: dict[str, Any]) -> T:
        for field, value in data.items():
            if value is not None:
                setattr(entity, field, value)

        return await self.save(entity)


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=User, session=session)

    async def get_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)

        result = await self._session.execute(query)

        return result.scalars().first()

    async def is_email_available(self, email: str) -> bool:
        user = await self.get_by_email(email)

        return user is None

    async def soft_delete(self, user: User) -> User:
        user.is_active = False

        return await self.save(user)
