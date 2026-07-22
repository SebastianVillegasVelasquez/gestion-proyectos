from uuid import UUID

from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.models import Notification
from app.modules.notifications.presentation.schemas import (
    MarkAllReadResponse,
    NotificationResponse,
    PaginatedNotificationsResponse,
    UnreadCountResponse,
)
from app.shared.exceptions import ForbiddenError, NotFoundError
from app.shared.pagination import Pagination


def _to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        message=n.message,
        user_to_id=n.user_to_id,
        actor_id=n.actor_id,
        notification_type=n.notification_type,
        payload=n.payload,
        read_at=n.read_at,
        is_read=n.is_read,
        created_at=n.created_at,
    )


class ListMyNotificationsUseCase:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def execute(
            self,
            user_id: UUID,
            only_unread: bool,
            pagination: Pagination,
    ) -> PaginatedNotificationsResponse:
        items, total = await self._repo.list_for_user(
            user_id=user_id,
            only_unread=only_unread,
            limit=pagination.limit,
            offset=pagination.offset,
        )
        unread_count = await self._repo.count_unread(user_id)
        return PaginatedNotificationsResponse(
            items=[_to_response(n) for n in items],
            total=total,
            unread_count=unread_count,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class GetUnreadCountUseCase:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> UnreadCountResponse:
        return UnreadCountResponse(unread_count=await self._repo.count_unread(user_id))


class MarkNotificationAsReadUseCase:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def execute(
            self, notification_id: UUID, requester_id: UUID
    ) -> NotificationResponse:
        n = await self._repo.get(notification_id)
        if n is None:
            raise NotFoundError("Notificación no encontrada")
        # Solo el destinatario puede marcar su propia notificación.
        if n.user_to_id != requester_id:
            raise ForbiddenError("No puedes modificar esta notificación")
        n = await self._repo.mark_as_read(n)
        return _to_response(n)


class MarkAllAsReadUseCase:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> MarkAllReadResponse:
        updated = await self._repo.mark_all_as_read(user_id)
        return MarkAllReadResponse(updated=updated)


class DeleteNotificationUseCase:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def execute(self, notification_id: UUID, requester_id: UUID) -> None:
        n = await self._repo.get(notification_id)
        if n is None:
            raise NotFoundError("Notificación no encontrada")
        if n.user_to_id != requester_id:
            raise ForbiddenError("No puedes borrar esta notificación")
        await self._repo.delete(n)
