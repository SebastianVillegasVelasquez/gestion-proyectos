import datetime
from uuid import UUID

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.shared.base_model import BaseModelConfig


class CollaboratorIdentity(BaseModelConfig):
    user_id: UUID
    name: str
    last_name: str
    email: str
    position: str


class CollaboratorCounts(BaseModelConfig):
    assigned: int = 0
    completed: int = 0
    in_progress: int = 0


class CollaboratorRow(BaseModelConfig):
    user_id: UUID
    name: str
    last_name: str
    position: str
    assigned_tasks: int = 0
    completed_tasks: int = 0


class CollaboratorTaskRead(BaseModelConfig):
    id: UUID
    title: str
    status: TaskStatus
    due_date: datetime.date
    completed_at: datetime.datetime | None = None


class CollaboratorHistoryRead(BaseModelConfig):
    id: UUID
    task_id: UUID
    task_title: str
    action: HistoryAction
    old_status: TaskStatus | None = None
    new_status: TaskStatus | None = None
    change_reason: str | None = None
    created_at: datetime.datetime
