import datetime
import uuid

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.traceability.domain.events import (
    EVENT_APROBACION,
    EVENT_ASIGNACION,
    EVENT_CAMBIO_ESTADO,
    EVENT_COMENTARIO,
    EVENT_CREACION,
    EVENT_DEVOLUCION,
    EVENT_ENTREGA,
    EVENT_INICIO,
    classify_event,
)

UTC = datetime.timezone.utc


def _dt(y, m, d):
    return datetime.datetime(y, m, d, tzinfo=UTC)


class TestClassifyKind:
    def test_creacion(self):
        c = classify_event(HistoryAction.CREACION, None, None, None)
        assert c.kind == EVENT_CREACION and c.is_delay is False

    def test_asignacion(self):
        assert classify_event(HistoryAction.REASIGNACION, None, None, None).kind == (
            EVENT_ASIGNACION
        )

    def test_comentario(self):
        assert classify_event(HistoryAction.COMENTARIO, None, None, None).kind == (
            EVENT_COMENTARIO
        )

    def test_state_changes_map_to_kinds(self):
        cases = {
            TaskStatus.EN_PROGRESO: EVENT_INICIO,
            TaskStatus.EN_REVISION: EVENT_ENTREGA,
            TaskStatus.COMPLETADA: EVENT_APROBACION,
            TaskStatus.DEVUELTA: EVENT_DEVOLUCION,
        }
        for status, expected in cases.items():
            c = classify_event(HistoryAction.CAMBIO_ESTADO, status, None, None)
            assert c.kind == expected

    def test_unknown_state_change_falls_back(self):
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO, TaskStatus.PENDIENTE_POR_INICIAR, None, None
        )
        assert c.kind == EVENT_CAMBIO_ESTADO

    def test_assignee_completing_own_task_is_a_direct_delivery(self):
        # Tarea sin aprobación obligatoria: el responsable la cierra él mismo.
        # No es "aprobó" (no hubo revisor), es "entregó".
        uid = uuid.uuid4()
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.COMPLETADA,
            None,
            None,
            actor_id=uid,
            assignee_id=uid,
        )
        assert c.kind == EVENT_ENTREGA

    def test_reviewer_completing_someone_elses_task_is_an_approval(self):
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.COMPLETADA,
            None,
            None,
            actor_id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
        )
        assert c.kind == EVENT_APROBACION

    def test_completed_without_ids_stays_approval(self):
        # Sin datos de actor/responsable se mantiene el comportamiento clásico.
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO, TaskStatus.COMPLETADA, None, None
        )
        assert c.kind == EVENT_APROBACION


class TestClassifyDelay:
    def test_state_change_after_due_date_is_delay(self):
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.EN_PROGRESO,
            datetime.date(2026, 1, 1),
            _dt(2026, 2, 1),  # un mes después del plazo
        )
        assert c.is_delay is True

    def test_completed_after_due_date_is_not_delay(self):
        # Una tarea ya cerrada no "retrasa" aunque el evento sea posterior.
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.COMPLETADA,
            datetime.date(2026, 1, 1),
            _dt(2026, 2, 1),
        )
        assert c.is_delay is False

    def test_on_time_change_is_not_delay(self):
        c = classify_event(
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.EN_PROGRESO,
            datetime.date(2026, 3, 1),
            _dt(2026, 2, 1),
        )
        assert c.is_delay is False

    def test_non_state_event_is_never_delay(self):
        c = classify_event(
            HistoryAction.COMENTARIO,
            None,
            datetime.date(2020, 1, 1),
            _dt(2026, 1, 1),
        )
        assert c.is_delay is False
