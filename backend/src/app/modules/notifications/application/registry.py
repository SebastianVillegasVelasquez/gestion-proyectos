from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskCommented,
    NotifyOnTaskCompleted,
    NotifyOnTaskCreated,
    NotifyOnTaskReturned,
    NotifyOnTaskSubmitted,
    RecordTaskCompletionInTraceability,
    RecordTaskCreationInTraceability,
    RecordTaskReturnInTraceability,
    RecordTaskSubmissionInTraceability,
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
from sqlalchemy.ext.asyncio import AsyncSession


def register_notification_handlers(
    bus: EventBus,
    notification_repo: NotificationRepository,
    broadcaster: Broadcaster,
    db: AsyncSession,
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

    # Traceability handlers (record task actions in history)
    bus.subscribe(TaskCreated, RecordTaskCreationInTraceability(db))
    bus.subscribe(TaskSubmitted, RecordTaskSubmissionInTraceability(db))
    bus.subscribe(TaskCompleted, RecordTaskCompletionInTraceability(db))
    bus.subscribe(TaskReturned, RecordTaskReturnInTraceability(db))
