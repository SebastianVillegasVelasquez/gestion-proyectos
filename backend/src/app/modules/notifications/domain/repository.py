from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.notifications.infrastructure.models import Notification


class NotificationRepository(ABC):
    """Contrato del repositorio de notificaciones (Dependency Inversion).

    El dominio y los handlers dependen de esta abstracción, no de SQLAlchemy.
    """

    @abstractmethod
    async def add(self, notification: Notification) -> Notification: ...

    @abstractmethod
    async def get(self, notification_id: UUID) -> Notification | None: ...

    @abstractmethod
    async def list_for_user(
        self,
        user_id: UUID,
        only_unread: bool,
        limit: int,
        offset: int,
    ) -> tuple[list[Notification], int]: ...

    @abstractmethod
    async def count_unread(self, user_id: UUID) -> int: ...

    @abstractmethod
    async def mark_as_read(self, notification: Notification) -> Notification: ...

    @abstractmethod
    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Marca todas las no-leídas del usuario. Devuelve cuántas se actualizaron."""

    @abstractmethod
    async def delete(self, notification: Notification) -> None: ...
