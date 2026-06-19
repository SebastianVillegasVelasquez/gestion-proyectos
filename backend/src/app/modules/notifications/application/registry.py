from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssigned,
    NotifyOnTaskSubmitted,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.project.domain.events import MemberAssigned
from app.modules.tasks.domain.events import TaskSubmitted
from app.shared.events import EventBus


def register_notification_handlers(
    bus: EventBus,
    notification_repo: NotificationRepository,
) -> None:
    bus.subscribe(MemberAssigned, NotifyOnMemberAssigned(notification_repo))
    bus.subscribe(TaskSubmitted, NotifyOnTaskSubmitted(notification_repo))
