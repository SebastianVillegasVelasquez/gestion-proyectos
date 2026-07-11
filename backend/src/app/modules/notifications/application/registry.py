from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskSubmitted,
    NotifyOnTaskCreated,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events import EventBus
from app.shared.events.events import MemberAssigned
from app.shared.events.events import TaskSubmitted, TaskCreated


def register_notification_handlers(
    bus: EventBus, notification_repo: NotificationRepository, broadcaster: Broadcaster
) -> None:
    bus.subscribe(
        MemberAssigned, NotifyOnMemberAssignedToProject(notification_repo, broadcaster)
    )
    bus.subscribe(TaskSubmitted, NotifyOnTaskSubmitted(notification_repo, broadcaster))
    bus.subscribe(TaskCreated, NotifyOnTaskCreated(notification_repo, broadcaster))
