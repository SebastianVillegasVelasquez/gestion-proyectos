from app.modules.notifications.application.handlers import (
    NotifyLeadsOnTaskStarted,
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskAssigned,
    NotifyOnTaskCommented,
    NotifyOnTaskCompleted,
    NotifyOnTaskCreated,
    NotifyOnTaskReturned,
    NotifyOnTaskSubmitted,
    NotifyProjectLeadsOnTaskCompleted,
)
from app.modules.notifications.application.preferences import TeamNotificationGate
from app.modules.notifications.domain.repository import NotificationRepository
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events import EventBus
from app.shared.events.events import (
    MemberAssigned,
    TaskAssigned,
    TaskCommented,
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskStarted,
    TaskSubmitted,
)


def register_notification_handlers(
    bus: EventBus,
    notification_repo: NotificationRepository,
    broadcaster: Broadcaster,
    session=None,
) -> None:
    # `session` (la AsyncSession del request) habilita los avisos que necesitan
    # consultar otras tablas: preferencias por-equipo (silenciar avisos) y los
    # líderes del proyecto. Sin ella, los handlers degradan a "avisar siempre".
    gate = TeamNotificationGate(session) if session is not None else None

    # Notification handlers
    bus.subscribe(
        MemberAssigned, NotifyOnMemberAssignedToProject(notification_repo, broadcaster)
    )
    bus.subscribe(TaskSubmitted, NotifyOnTaskSubmitted(notification_repo, broadcaster))
    bus.subscribe(
        TaskCreated, NotifyOnTaskCreated(notification_repo, broadcaster, gate)
    )
    bus.subscribe(
        TaskAssigned, NotifyOnTaskAssigned(notification_repo, broadcaster, gate)
    )
    bus.subscribe(
        TaskCompleted, NotifyOnTaskCompleted(notification_repo, broadcaster, gate)
    )
    bus.subscribe(
        TaskReturned, NotifyOnTaskReturned(notification_repo, broadcaster, gate)
    )
    bus.subscribe(
        TaskCommented, NotifyOnTaskCommented(notification_repo, broadcaster, gate)
    )
    if session is not None:
        # Aviso a coordinación/supervisión del proyecto: la aprobación mueve el %.
        bus.subscribe(
            TaskCompleted,
            NotifyProjectLeadsOnTaskCompleted(notification_repo, broadcaster, session),
        )
        # Aviso a quien coordina cuando el responsable arranca una tarea.
        bus.subscribe(
            TaskStarted,
            NotifyLeadsOnTaskStarted(notification_repo, broadcaster, session),
        )

    # El historial de trazabilidad ya NO se escribe aquí. Colgaba del bus de
    # notificaciones y por eso guardaba como autor del cambio al RESPONSABLE de
    # la tarea (lo único que llevan estos eventos), no a quien lo hizo. Ahora lo
    # escribe `TaskAuditor` desde los casos de uso, que sí conocen al actor.
