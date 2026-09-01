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
    # Permite que la vista del usuario agrupe sus tareas por proyecto y enlace
    # a cada uno (con el nombre solo no se puede navegar).
    project_id: UUID | None = None
    # Opcional: una tarea puede no tener fecha límite fijada todavía. El front la
    # muestra como "sin fecha"; antes esto provocaba un 500 al serializar.
    due_date: datetime.date | None = None


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


class ActivityItemResponse(BaseModelConfig):
    """Un evento de actividad reciente ya clasificado para la UI.

    `kind` es el tipo semántico del evento (creacion, entrega, aprobacion…); el
    frontend decide su icono y color. `actor_name`/`project_name` pueden faltar.
    """

    id: UUID
    task_id: UUID
    task_title: str
    project_name: str | None = None
    actor_name: str | None = None
    kind: str
    created_at: datetime.datetime


class RecentActivityResponse(BaseModelConfig):
    items: list[ActivityItemResponse]


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


class PublicScheduleItemResponse(BaseModelConfig):
    """Fila del cronograma público: un elemento de la estructura con su tiempo.

    El cliente ve el flujo del proyecto por sus componentes/entregables, nunca
    las tareas ni quién las ejecuta. `key`/`parent_key` son índices opacos (no
    identificadores internos) que solo reconstruyen la jerarquía en la UI.
    """

    key: str
    parent_key: str | None = None
    name: str
    depth: int
    order: int
    start_date: datetime.date
    due_date: datetime.date
    status: str  # value del enum de tareas (para el color de la barra)
    progress_pct: int
    # Tipo del elemento: el portal pinta la barra con el MISMO color que la
    # Estructura y el cronograma interno (paleta determinista sobre `tipo_id`,
    # naranja fijo si `es_dependencia_externa`).
    tipo_id: str | None = None
    tipo_nombre: str | None = None
    es_dependencia_externa: bool = False


class PublicProjectScheduleResponse(BaseModelConfig):
    """Cronograma del proyecto para el portal público del cliente (solo lectura)."""

    project_name: str
    items: list[PublicScheduleItemResponse]
