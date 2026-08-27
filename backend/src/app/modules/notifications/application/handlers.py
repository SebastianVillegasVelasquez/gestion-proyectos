import json

from app.core.logger import get_logger
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events.events import MemberAssigned
from app.shared.events.events import (
    TaskCommented,
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskSubmitted,
)

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
            message="Tu tarea quedó marcada como entregada y está en revisión.",
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


class NotifyOnTaskCommented:
    """Avisa a los mencionados y al responsable de la tarea.

    Prioridad de aviso: una MENCIÓN es una petición directa ("esto es para
    ti"), mientras que un comentario suelto es solo actividad. Por eso quien
    esté mencionado recibe la mención y no el aviso genérico —de lo contrario
    llegarían dos notificaciones por el mismo comentario—.

    Nadie se autonotifica: comentar tu propia tarea o mencionarte a ti mismo no
    genera aviso.
    """

    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ) -> None:
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: TaskCommented) -> None:
        mentioned = {uid for uid in event.mentioned_user_ids if uid != event.author_id}
        payload = {
            "task_id": str(event.task_id),
            "comment_id": str(event.comment_id),
        }

        recipients: list[tuple] = [
            (uid, NotificationType.MENCION, "Te mencionaron en una tarea")
            for uid in mentioned
        ]
        # El responsable solo recibe el aviso genérico si no estaba mencionado.
        if (
            event.assignee_id is not None
            and event.assignee_id != event.author_id
            and event.assignee_id not in mentioned
        ):
            recipients.append(
                (
                    event.assignee_id,
                    NotificationType.COMENTARIO_PUBLICADO,
                    "Comentaron en una tarea tuya",
                )
            )

        for user_id, notification_type, message in recipients:
            await self._repo.add(
                Notification(
                    user_to_id=user_id,
                    actor_id=event.author_id,
                    notification_type=notification_type,
                    message=message,
                    payload=payload,
                )
            )
            try:
                await self._broadcaster.publish(
                    channel=channel_for(user_id),
                    message=json.dumps({"type": "notification.new"}),
                )
            except Exception:
                logger.exception(
                    "Error al publicar la notificacion al usuario %s", user_id
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
        # Sin responsable no hay a quién notificar (p. ej. una tarea delegada a un
        # equipo, que el líder repartirá después). Evita insertar con user_to_id
        # NULL, que rompería la restricción de la tabla.
        if event.assigned_id is None:
            return

        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_ASIGNADA,
            message="Te asignaron una nueva tarea. Revisa los detalles antes de iniciarla.",
            payload={
                "work_item_id": str(event.work_item_id) if event.work_item_id else None,
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


class NotifyOnTaskCompleted:
    """Aviso al responsable cuando el líder aprueba su entrega."""

    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: TaskCompleted) -> None:
        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_COMPLETADA,
            message="Tu entrega fue aprobada y la tarea quedó completada.",
            payload={
                "project_id": str(event.project_id),
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


class NotifyOnTaskReturned:
    """Aviso al responsable cuando el líder devuelve su entrega para corregir."""

    def __init__(
        self, notification_repo: NotificationRepository, broadcaster: Broadcaster
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster

    async def __call__(self, event: TaskReturned) -> None:
        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_DEVUELTA,
            message="Tu entrega fue devuelta con observaciones. Ajusta lo indicado y vuelve a enviarla.",
            payload={
                "project_id": str(event.project_id),
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
