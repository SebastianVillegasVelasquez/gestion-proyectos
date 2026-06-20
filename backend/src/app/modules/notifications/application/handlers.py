from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.project.domain.events import MemberAssigned
from app.modules.tasks.domain.events import TaskSubmitted


class NotifyOnTaskSubmitted:
    def __init__(self, notification_repo):
        self.notification_repo = notification_repo

    async def __call__(self, event: TaskSubmitted) -> None:
        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_ENTREGADA,
            message="La tarea ha sido entregada",
        )
        await self.notification_repo.add(notification)


class NotifyOnMemberAssigned:
    """Reacciona a MemberAssigned creando una notificación in-app al asignado."""

    def __init__(self, notification_repo: NotificationRepository) -> None:
        self._repo = notification_repo

    async def __call__(self, event: MemberAssigned) -> None:
        # Evita auto-notificación (te asignaste a ti mismo).
        if event.assigned_by == event.user_id:
            return

        notification = Notification(
            user_to_id=event.user_id,
            actor_id=event.assigned_by,
            notification_type=NotificationType.PROYECTO_MIEMBRO_AGREGADO,
            message="Fuiste agregado a un proyecto",
            payload={
                "project_id": str(event.project_id),
                "project_role": event.project_role.value,
            },
        )
        await self._repo.add(notification)
