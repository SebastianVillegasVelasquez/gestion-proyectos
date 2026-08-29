from uuid import UUID

from app.modules.traceability.domain.events import (
    EVENT_APROBACION,
    EVENT_ASIGNACION,
    EVENT_DEVOLUCION,
    EVENT_ENTREGA,
    EVENT_EQUIPO,
    EVENT_REPROGRAMACION,
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
# Un cambio de responsable y uno de equipo cuentan igual: en ambos casos el
# trabajo cambió de manos, que es lo que el coordinador quiere detectar.
_HANDOVER_KINDS = {EVENT_ASIGNACION, EVENT_EQUIPO}


class GetProjectTraceabilityUseCase:
    """Línea de tiempo de eventos de un proyecto con un resumen accionable.

    Clasifica cada evento con la regla pura del dominio y agrega los contadores
    que el administrador usa para detectar de un vistazo retrasos y devoluciones.
    """

    def __init__(self, repo: TraceabilityRepository) -> None:
        self._repo = repo

    async def execute(
        self, project_id: UUID, team_id: UUID | None = None
    ) -> ProjectTraceabilityResponse:
        if not await self._repo.project_exists(project_id):
            raise NotFoundError("Proyecto no encontrado")

        rows = await self._repo.list_events(project_id)
        # Trazabilidad acotada a un equipo: la piden los líderes/supervisores de
        # equipo, que solo pueden ver la actividad de SU equipo. El resumen se
        # recalcula sobre lo filtrado para que los contadores cuadren con la
        # línea de tiempo visible.
        if team_id is not None:
            rows = [row for row in rows if row.team_id == team_id]

        events: list[TraceabilityEvent] = []
        delays = deliveries = returns = reschedules = reassignments = 0
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
            if classification.kind == EVENT_REPROGRAMACION:
                reschedules += 1
            if classification.kind in _HANDOVER_KINDS:
                reassignments += 1

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
                    old_value=row.old_value,
                    new_value=row.new_value,
                    created_at=row.created_at,
                    work_item_id=row.work_item_id,
                    work_item_name=row.work_item_name,
                    team_id=row.team_id,
                    team_name=row.team_name,
                    assignee_name=row.assignee_name,
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
                reschedules=reschedules,
                reassignments=reassignments,
            ),
            events=events,
        )
