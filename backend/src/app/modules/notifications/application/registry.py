from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskCommented,
    NotifyOnTaskCompleted,
    NotifyOnTaskCreated,
    NotifyOnTaskReturned,
    NotifyOnTaskSubmitted,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events import EventBus
from app.shared.events.events import (
    MemberAssigned,
    TaskCommented,
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskSubmitted,
)


def register_notification_handlers(
    bus: EventBus,
    notification_repo: NotificationRepository,
    broadcaster: Broadcaster,
) -> None:
    # Notification handlers
    bus.subscribe(
        MemberAssigned, NotifyOnMemberAssignedToProject(notification_repo, broadcaster)
    )
    bus.subscribe(TaskSubmitted, NotifyOnTaskSubmitted(notification_repo, broadcaster))
    bus.subscribe(TaskCreated, NotifyOnTaskCreated(notification_repo, broadcaster))
    bus.subscribe(TaskCompleted, NotifyOnTaskCompleted(notification_repo, broadcaster))
    bus.subscribe(TaskReturned, NotifyOnTaskReturned(notification_repo, broadcaster))
    bus.subscribe(TaskCommented, NotifyOnTaskCommented(notification_repo, broadcaster))

    # El historial de trazabilidad ya NO se escribe aquí. Colgaba del bus de
    # notificaciones y por eso guardaba como autor del cambio al RESPONSABLE de
    # la tarea (lo único que llevan estos eventos), no a quien lo hizo. Ahora lo
    # escribe `TaskAuditor` desde los casos de uso, que sí conocen al actor.
