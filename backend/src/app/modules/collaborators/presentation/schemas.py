import datetime
from uuid import UUID

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.shared.base_model import BaseModelConfig


class CollaboratorListItem(BaseModelConfig):
    """Fila de la tabla de colaboradores: identidad + avance de tareas."""

    user_id: UUID
    name: str
    last_name: str
    position: str
    assigned_tasks: int
    completed_tasks: int
    completion_pct: int


class PaginatedCollaboratorsResponse(BaseModelConfig):
    items: list[CollaboratorListItem]
    total: int
    page: int
    page_size: int


class CollaboratorTaskItem(BaseModelConfig):
    id: UUID
    title: str
    status: TaskStatus
    due_date: datetime.date | None = None
    completed_at: datetime.datetime | None = None


class CollaboratorHistoryItem(BaseModelConfig):
    id: UUID
    task_id: UUID
    task_title: str
    action: HistoryAction
    old_status: TaskStatus | None = None
    new_status: TaskStatus | None = None
    change_reason: str | None = None
    created_at: datetime.datetime


class CollaboratorActivityResponse(BaseModelConfig):
    user_id: UUID
    name: str
    last_name: str
    email: str
    position: str
    assigned_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    completion_pct: int
    project_count: int
    team_count: int
    tasks: list[CollaboratorTaskItem]
    history: list[CollaboratorHistoryItem]
