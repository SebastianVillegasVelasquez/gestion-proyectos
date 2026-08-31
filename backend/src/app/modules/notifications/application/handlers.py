import json

from app.core.logger import get_logger
from app.modules.notifications.application.preferences import (
    TeamNotificationGate,
    project_lead_ids,
    team_lead_ids,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events.events import MemberAssigned
from app.shared.events.events import (
    TaskAssigned,
    TaskCommented,
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskStarted,
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
                "project_id": (str(event.project_id) if event.project_id else None),
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
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        gate: TeamNotificationGate | None = None,
    ) -> None:
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._gate = gate

    async def __call__(self, event: TaskCommented) -> None:
        mentioned = {uid for uid in event.mentioned_user_ids if uid != event.author_id}
        payload = {
            "task_id": str(event.task_id),
            "comment_id": str(event.comment_id),
            "project_id": str(event.project_id) if event.project_id else None,
        }

        recipients: list[tuple] = [
            (uid, NotificationType.MENCION, "Te mencionaron en una tarea")
            for uid in mentioned
        ]
        # El responsable solo recibe el aviso genérico si no estaba mencionado
        # y si no silenció los comentarios de este equipo. Una MENCIÓN, en
        # cambio, es una petición directa y siempre pasa.
        notify_assignee = (
            event.assignee_id is not None
            and event.assignee_id != event.author_id
            and event.assignee_id not in mentioned
        )
        if notify_assignee and self._gate is not None:
            notify_assignee = await self._gate.allows(
                team_id=event.team_id,
                user_id=event.assignee_id,  # type: ignore[arg-type]
                field="comentario_nuevo",
            )
        if notify_assignee:
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
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        gate: TeamNotificationGate | None = None,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._gate = gate

    async def __call__(self, event: TaskCreated) -> None:
        # Sin responsable no hay a quién notificar (p. ej. una tarea delegada a un
        # equipo, que el líder repartirá después). Evita insertar con user_to_id
        # NULL, que rompería la restricción de la tabla.
        if event.assigned_id is None:
            return

        if self._gate is not None and not await self._gate.allows(
            team_id=event.team_id,
            user_id=event.assigned_id,
            field="nueva_tarea_asignada",
        ):
            return

        notification = Notification(
            user_to_id=event.assigned_id,
            notification_type=NotificationType.TAREA_ASIGNADA,
            message="Te asignaron una nueva tarea. Revisa los detalles antes de iniciarla.",
            payload={
                "work_item_id": str(event.work_item_id) if event.work_item_id else None,
                "task_id": str(event.task_id),
                "project_id": (str(event.project_id) if event.project_id else None),
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
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        gate: TeamNotificationGate | None = None,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._gate = gate

    async def __call__(self, event: TaskCompleted) -> None:
        if self._gate is not None and not await self._gate.allows(
            team_id=event.team_id,
            user_id=event.assigned_id,
            field="entregable_aprobado",
        ):
            return

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
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        gate: TeamNotificationGate | None = None,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._gate = gate

    async def __call__(self, event: TaskReturned) -> None:
        if self._gate is not None and not await self._gate.allows(
            team_id=event.team_id,
            user_id=event.assigned_id,
            field="entregable_rechazado",
        ):
            return

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


class NotifyOnTaskAssigned:
    """Aviso cuando se (re)asigna una tarea ya existente a una persona.

    Complementa a `NotifyOnTaskCreated`: la reasignación del líder o el alta de
    tarea de equipo que fija el responsable en un segundo paso pasan por aquí.
    Nadie se autonotifica (si el líder se asigna la tarea a sí mismo, no hay
    aviso). Respeta el toggle `nueva_tarea_asignada` del equipo.
    """

    def __init__(
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        gate: TeamNotificationGate | None = None,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._gate = gate

    async def __call__(self, event: TaskAssigned) -> None:
        if event.assigned_by is not None and event.assigned_by == event.assignee_id:
            return

        if self._gate is not None and not await self._gate.allows(
            team_id=event.team_id,
            user_id=event.assignee_id,
            field="nueva_tarea_asignada",
        ):
            return

        await self._repo.add(
            Notification(
                user_to_id=event.assignee_id,
                actor_id=event.assigned_by,
                notification_type=NotificationType.TAREA_ASIGNADA,
                message="Te asignaron una tarea. Revisa los detalles antes de iniciarla.",
                payload={
                    "work_item_id": (
                        str(event.work_item_id) if event.work_item_id else None
                    ),
                    "task_id": str(event.task_id),
                    "project_id": str(event.project_id) if event.project_id else None,
                },
            )
        )
        try:
            await self._broadcaster.publish(
                channel=channel_for(event.assignee_id),
                message=json.dumps({"type": "notification.new"}),
            )
        except Exception:
            logger.exception(
                "Error al publicar la notificacion al usuario %s", event.assignee_id
            )


class NotifyLeadsOnTaskStarted:
    """El responsable marcó que empezó una tarea (→ EN_PROGRESO): se avisa a
    quien coordina. Si la tarea está delegada a un equipo, a sus líderes y
    supervisores; si no, a coordinación/supervisión del proyecto. Nunca al
    propio responsable ni a quien movió el estado.

    Necesita la sesión del request para leer los miembros del equipo/proyecto.
    """

    def __init__(
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        session,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._session = session

    async def __call__(self, event: TaskStarted) -> None:
        if self._session is None:
            return
        exclude = {event.assigned_id}
        if event.actor_id is not None:
            exclude.add(event.actor_id)
        try:
            if event.team_id is not None:
                recipients = await team_lead_ids(
                    self._session, event.team_id, exclude=exclude
                )
            else:
                recipients = await project_lead_ids(
                    self._session, event.project_id, exclude=exclude
                )
        except Exception:
            logger.exception(
                "No se pudieron resolver los líderes para la tarea iniciada %s",
                event.task_id,
            )
            return

        for user_id in recipients:
            await self._repo.add(
                Notification(
                    user_to_id=user_id,
                    actor_id=event.actor_id,
                    notification_type=NotificationType.TAREA_INICIADA,
                    message="Un integrante empezó a trabajar una tarea.",
                    payload={
                        "project_id": str(event.project_id),
                        "task_id": str(event.task_id),
                        "team_id": (str(event.team_id) if event.team_id else None),
                    },
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


class NotifyProjectLeadsOnTaskCompleted:
    """Cuando se aprueba una tarea, el avance del proyecto sube: se avisa a
    quienes coordinan/supervisan el proyecto (no al responsable, que ya recibe
    su propio aviso, ni a quien aprobó).

    Necesita la sesión del request para leer los miembros del proyecto; por eso
    vive fuera de `NotificationRepository`.
    """

    def __init__(
        self,
        notification_repo: NotificationRepository,
        broadcaster: Broadcaster,
        session,
    ):
        self._repo = notification_repo
        self._broadcaster = broadcaster
        self._session = session

    async def __call__(self, event: TaskCompleted) -> None:
        if self._session is None:
            return
        exclude = {event.assigned_id}
        if event.actor_id is not None:
            exclude.add(event.actor_id)
        try:
            recipients = await project_lead_ids(
                self._session, event.project_id, exclude=exclude
            )
        except Exception:
            logger.exception(
                "No se pudieron resolver los líderes del proyecto %s",
                event.project_id,
            )
            return

        for user_id in recipients:
            await self._repo.add(
                Notification(
                    user_to_id=user_id,
                    actor_id=event.actor_id,
                    notification_type=NotificationType.TAREA_COMPLETADA,
                    message="Se aprobó una tarea del proyecto y su avance se actualizó.",
                    payload={
                        "project_id": str(event.project_id),
                        "task_id": str(event.task_id),
                    },
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
