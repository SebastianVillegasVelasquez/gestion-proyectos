from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
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
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskSubmitted,
)


def register_notification_handlers(
    bus: EventBus, notification_repo: NotificationRepository, broadcaster: Broadcaster
) -> None:
    bus.subscribe(
        MemberAssigned, NotifyOnMemberAssignedToProject(notification_repo, broadcaster)
    )
    bus.subscribe(TaskSubmitted, NotifyOnTaskSubmitted(notification_repo, broadcaster))
    bus.subscribe(TaskCreated, NotifyOnTaskCreated(notification_repo, broadcaster))
    bus.subscribe(TaskCompleted, NotifyOnTaskCompleted(notification_repo, broadcaster))
    bus.subscribe(TaskReturned, NotifyOnTaskReturned(notification_repo, broadcaster))
