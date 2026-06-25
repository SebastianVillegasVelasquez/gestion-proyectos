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
    created_at: datetime.datetime
    # Derivados (clasificación semántica del dominio):
    kind: str
    is_delay: bool


class TraceabilitySummary(BaseModelConfig):
    """Conteos para resumir de un vistazo el estado de la trazabilidad."""

    total_events: int
    delays: int
    deliveries: int  # entregas + aprobaciones
    returns: int  # devoluciones


class ProjectTraceabilityResponse(BaseModelConfig):
    project_id: UUID
    summary: TraceabilitySummary
    events: list[TraceabilityEvent]
