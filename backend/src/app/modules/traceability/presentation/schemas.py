import datetime
from uuid import UUID

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.shared.base_model import BaseModelConfig


class TraceabilityEvent(BaseModelConfig):
    id: UUID
    task_id: UUID
    task_title: str
    actor_name: str | None = None
    action: HistoryAction
    old_status: TaskStatus | None = None
    new_status: TaskStatus | None = None
    change_reason: str | None = None
    # Delta legible de los cambios que no son de estado (equipo, ubicación,
    # fechas, prioridad), ya resuelto a texto en el momento del cambio.
    old_value: str | None = None
    new_value: str | None = None
    created_at: datetime.datetime
    # Contexto actual de la tarea: permite filtrar la línea de tiempo.
    work_item_id: UUID | None = None
    work_item_name: str | None = None
    team_id: UUID | None = None
    team_name: str | None = None
    assignee_name: str | None = None
    # Derivados (clasificación semántica del dominio):
    kind: str
    is_delay: bool


class TraceabilitySummary(BaseModelConfig):
    """Conteos para resumir de un vistazo el estado de la trazabilidad."""

    total_events: int
    delays: int
    deliveries: int  # entregas + aprobaciones
    returns: int  # devoluciones
    reschedules: int  # veces que se movieron las fechas de una tarea
    reassignments: int  # cambios de responsable o de equipo


class ProjectTraceabilityResponse(BaseModelConfig):
    project_id: UUID
    summary: TraceabilitySummary
    events: list[TraceabilityEvent]
