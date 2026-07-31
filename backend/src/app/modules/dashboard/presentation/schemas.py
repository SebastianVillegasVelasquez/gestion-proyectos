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


class MyProjectProgressResponse(BaseModelConfig):
    """Progreso general de un proyecto (solo lectura) + tareas propias del usuario."""

    id: UUID
    name: str
    client_name: str | None = None
    coordinator: str | None = None
    status: str  # active | at-risk | in-review
    tasks_total: int
    tasks_completed: int
    tasks_in_review: int
    tasks_overdue: int
    tasks_pending: int
    progress_pct: int
    my_tasks: list[TaskBoardItemResponse]


class PublicProjectAccessRequest(BaseModelConfig):
    """Credencial del portal del cliente: el token viaja en el cuerpo, no en la URL.

    Enviarlo por POST evita que el token quede registrado en historiales del
    navegador, logs de servidor o cabeceras `Referer`, y permite entregar enlace
    y token por separado (el cliente introduce el token en la pantalla de acceso).
    """

    token: str


class PublicProjectProgressResponse(BaseModelConfig):
    """Progreso del proyecto para el portal público del cliente (solo lectura).

    No incluye `id` ni tareas individuales: el cliente ve solo el avance agregado
    y nada que permita navegar o inferir la estructura interna del sistema.
    """

    name: str
    client_name: str | None = None
    coordinator: str | None = None
    status: str  # active | at-risk | in-review
    tasks_total: int
    tasks_completed: int
    tasks_in_review: int
    tasks_overdue: int
    tasks_pending: int
    progress_pct: int
