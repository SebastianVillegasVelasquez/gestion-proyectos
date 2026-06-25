import datetime
from uuid import uuid4

import pytest

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.traceability.application.use_cases import (
    GetProjectTraceabilityUseCase,
)
from app.modules.traceability.domain.events import EVENT_DEVOLUCION, EVENT_INICIO
from app.modules.traceability.presentation.schemas import ProjectTraceabilityResponse
from app.shared.exceptions import NotFoundError

UTC = datetime.timezone.utc


class TestGetProjectTraceabilityUseCase:
    async def test_should_raise_not_found_when_project_missing(
        self, build_fake_traceability_repo
    ):
        repo = build_fake_traceability_repo(exists=False)
        with pytest.raises(NotFoundError):
            await GetProjectTraceabilityUseCase(repo).execute(uuid4())

    async def test_should_classify_events_and_count_summary(
        self, build_fake_traceability_repo, make_event_row
    ):
        events = [
            # Retraso: cambio en progreso un mes después del plazo.
            make_event_row(
                action=HistoryAction.CAMBIO_ESTADO,
                new_status=TaskStatus.EN_PROGRESO,
                due_date=datetime.date(2026, 1, 1),
                created_at=datetime.datetime(2026, 2, 1, tzinfo=UTC),
            ),
            # Entrega (a revisión).
            make_event_row(
                action=HistoryAction.CAMBIO_ESTADO,
                new_status=TaskStatus.EN_REVISION,
                due_date=datetime.date(2026, 3, 1),
                created_at=datetime.datetime(2026, 2, 1, tzinfo=UTC),
            ),
            # Aprobación (cuenta como entrega también).
            make_event_row(
                action=HistoryAction.CAMBIO_ESTADO,
                new_status=TaskStatus.COMPLETADA,
                due_date=datetime.date(2026, 3, 1),
                created_at=datetime.datetime(2026, 2, 15, tzinfo=UTC),
            ),
            # Devolución.
            make_event_row(
                action=HistoryAction.CAMBIO_ESTADO,
                new_status=TaskStatus.DEVUELTA,
                due_date=datetime.date(2026, 3, 1),
                created_at=datetime.datetime(2026, 2, 10, tzinfo=UTC),
            ),
        ]
        repo = build_fake_traceability_repo(events=events)

        response = await GetProjectTraceabilityUseCase(repo).execute(uuid4())

        assert isinstance(response, ProjectTraceabilityResponse)
        assert response.summary.total_events == 4
        assert response.summary.delays == 1
        assert response.summary.deliveries == 2  # entrega + aprobación
        assert response.summary.returns == 1
        assert response.events[0].kind == EVENT_INICIO
        assert response.events[0].is_delay is True
        assert response.events[3].kind == EVENT_DEVOLUCION

    async def test_should_return_empty_timeline(self, build_fake_traceability_repo):
        repo = build_fake_traceability_repo(events=[])
        response = await GetProjectTraceabilityUseCase(repo).execute(uuid4())
        assert response.summary.total_events == 0
        assert response.events == []
