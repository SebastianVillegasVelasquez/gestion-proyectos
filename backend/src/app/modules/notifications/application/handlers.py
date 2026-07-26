import json

from app.core.logger import get_logger
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import TaskHistory
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events.events import MemberAssigned
from app.shared.events.events import (
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskSubmitted,
)
from sqlalchemy.ext.asyncio import AsyncSession

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


# ── Handlers de Trazabilidad ────────────────────────────────────────────────
# Registran eventos de tareas en el historial (TaskHistory) para que los
# coordinadores y supervisores puedan ver la trazabilidad completa de
# acciones dentro del proyecto.


class RecordTaskCreationInTraceability:
    """Registra en la trazabilidad cuando se crea una tarea."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def __call__(self, event: TaskCreated) -> None:
        history = TaskHistory(
            task_id=event.task_id,
            changed_by_id=event.assigned_id,
            action=HistoryAction.CREACION,
        )
        self._db.add(history)
        await self._db.flush()


class RecordTaskSubmissionInTraceability:
    """Registra en la trazabilidad cuando se entrega una tarea (cambio a EN_REVISION)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def __call__(self, event: TaskSubmitted) -> None:
        history = TaskHistory(
            task_id=event.task_id,
            changed_by_id=event.assigned_id,
            action=HistoryAction.CAMBIO_ESTADO,
            old_status=TaskStatus.EN_PROGRESO,
            new_status=TaskStatus.EN_REVISION,
        )
        self._db.add(history)
        await self._db.flush()


class RecordTaskCompletionInTraceability:
    """Registra en la trazabilidad cuando se aprueba una entrega (cambio a COMPLETADA)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def __call__(self, event: TaskCompleted) -> None:
        history = TaskHistory(
            task_id=event.task_id,
            changed_by_id=event.assigned_id,
            action=HistoryAction.CAMBIO_ESTADO,
            old_status=TaskStatus.EN_REVISION,
            new_status=TaskStatus.COMPLETADA,
        )
        self._db.add(history)
        await self._db.flush()


class RecordTaskReturnInTraceability:
    """Registra en la trazabilidad cuando se devuelve una entrega (cambio a DEVUELTA)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def __call__(self, event: TaskReturned) -> None:
        history = TaskHistory(
            task_id=event.task_id,
            changed_by_id=event.assigned_id,
            action=HistoryAction.CAMBIO_ESTADO,
            old_status=TaskStatus.EN_REVISION,
            new_status=TaskStatus.DEVUELTA,
        )
        self._db.add(history)
        await self._db.flush()
