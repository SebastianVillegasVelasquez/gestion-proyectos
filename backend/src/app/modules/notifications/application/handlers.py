import json

from app.core.logger import get_logger
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events.events import MemberAssigned
from app.shared.events.events import TaskSubmitted, TaskCreated

logger = get_logger(__name__)


def channel_for(user_id) -> str:
    return f"notifications:user:{user_id}"  # Construye el canal


class NotifyOnTaskSubmitted:
    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: TaskSubmitted) -> None:
        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_ENTREGADA,
            message="La tarea ha sido entregada",
            payload={
                "work_item_id": str(event.work_item_id),
                "task_id": str(event.task_id),
            },
        )
        await self._repo.add(notification)
        try:
            await self._broadcaster.publish(
                channel=channel_for(event.assigned_id),
                message=json.dumps({"type": "notification.new"}),
            )
        except Exception:
            logger.exception(
                "Error al publicar la notificacion al usuario %s", event.assigned_id
            )


class NotifyOnMemberAssignedToProject:
    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ) -> None:
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: MemberAssigned) -> None:
        if event.assigned_by == event.user_id:
            return

        notification = Notification(
            user_to_id=event.user_id,
            actor_id=event.assigned_by,
            notification_type=NotificationType.PROYECTO_MIEMBRO_AGREGADO,
            message="Fuiste agregado a un proyecto",
            payload={
                "work_item_id": str(event.project_id),
                "project_role": event.project_role.value,
            },
        )
        await self._repo.add(notification)
        try:
            await self._broadcaster.publish(
                channel=channel_for(event.user_id),
                message=json.dumps({"type": "notification.new"}),
            )
        except Exception:
            logger.exception(
                "Error al publicar la notificacion al usuario %s", event.user_id
            )


class NotifyOnTaskCreated:
    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: TaskCreated) -> None:
        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_ASIGNADA,
            message="Te asignaron una nueva tarea",
            payload={
                "work_item_id": str(event.work_item_id),
                "task_id": str(event.task_id),
            },
        )
        await self._repo.add(notification)
        try:
            await self._broadcaster.publish(
                channel=channel_for(event.assigned_id),
                message=json.dumps({"type": "notification.new"}),
            )
        except Exception:
            logger.exception(
                "Error al publicar la notificacion al usuario %s", event.assigned_id
            )
