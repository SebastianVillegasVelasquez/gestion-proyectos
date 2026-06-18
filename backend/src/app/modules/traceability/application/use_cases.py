from uuid import UUID

from app.modules.traceability.domain.events import (
    EVENT_APROBACION,
    EVENT_DEVOLUCION,
    EVENT_ENTREGA,
    classify_event,
)
from app.modules.traceability.infrastructure.repository import TraceabilityRepository
from app.modules.traceability.presentation.schemas import (
    ProjectTraceabilityResponse,
    TraceabilityEvent,
    TraceabilitySummary,
)
from app.shared.exceptions import NotFoundError

_DELIVERY_KINDS = {EVENT_ENTREGA, EVENT_APROBACION}


class GetProjectTraceabilityUseCase:
    """Línea de tiempo de eventos de un proyecto con un resumen accionable.

    Clasifica cada evento con la regla pura del dominio y agrega los contadores
    que el administrador usa para detectar de un vistazo retrasos y devoluciones.
    """

    def __init__(self, repo: TraceabilityRepository) -> None:
        self._repo = repo

    async def execute(self, project_id: UUID) -> ProjectTraceabilityResponse:
        if not await self._repo.project_exists(project_id):
            raise NotFoundError("Proyecto no encontrado")

        rows = await self._repo.list_events(project_id)

        events: list[TraceabilityEvent] = []
        delays = deliveries = returns = 0
        for row in rows:
            classification = classify_event(
                action=row.action,
                new_status=row.new_status,
                due_date=row.due_date,
                occurred_on=row.created_at,
            )
            if classification.is_delay:
                delays += 1
            if classification.kind in _DELIVERY_KINDS:
                deliveries += 1
            if classification.kind == EVENT_DEVOLUCION:
                returns += 1

            events.append(
                TraceabilityEvent(
                    id=row.id,
                    task_id=row.task_id,
                    task_title=row.task_title,
                    actor_name=row.actor_name,
                    action=row.action,
                    old_status=row.old_status,
                    new_status=row.new_status,
                    change_reason=row.change_reason,
                    created_at=row.created_at,
                    kind=classification.kind,
                    is_delay=classification.is_delay,
                )
            )

        return ProjectTraceabilityResponse(
            project_id=project_id,
            summary=TraceabilitySummary(
                total_events=len(events),
                delays=delays,
                deliveries=deliveries,
                returns=returns,
            ),
            events=events,
        )
