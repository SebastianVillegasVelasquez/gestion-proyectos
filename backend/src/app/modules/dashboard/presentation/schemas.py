import datetime
from uuid import UUID

from app.shared.base_model import BaseModelConfig


class DashboardSummaryResponse(BaseModelConfig):
    active_projects: int
    total_tasks: int
    completed_tasks: int
    in_review_tasks: int
    overdue_tasks: int


class TaskBoardItemResponse(BaseModelConfig):
    id: UUID
    title: str
    status: str  # value del enum de tareas (ej. "en_progreso")
    project_name: str | None = None
    due_date: datetime.date


class ProjectOverviewItemResponse(BaseModelConfig):
    id: UUID
    name: str
    client_name: str | None = None
    coordinator: str | None = None
    tasks_total: int
    tasks_completed: int
    progress_pct: int
    status: str  # active | at-risk | in-review


class DeadlineItemResponse(BaseModelConfig):
    id: UUID
    title: str
    project_name: str | None = None
    due_date: datetime.date


class DashboardPanelsResponse(BaseModelConfig):
    task_board: list[TaskBoardItemResponse]
    projects: list[ProjectOverviewItemResponse]
    upcoming_deadlines: list[DeadlineItemResponse]
