import datetime
from uuid import UUID, uuid4

import pytest

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.traceability.infrastructure.repository import (
    TraceabilityEventRow,
    TraceabilityRepository,
)


class FakeTraceabilityRepository(TraceabilityRepository):
    def __init__(
        self,
        events: list[TraceabilityEventRow] | None = None,
        exists: bool = True,
    ) -> None:
        self._events = events or []
        self._exists = exists

    async def project_exists(self, project_id: UUID) -> bool:
        return self._exists

    async def list_events(self, project_id: UUID) -> list[TraceabilityEventRow]:
        return self._events


@pytest.fixture
def build_fake_traceability_repo():
    def _make(events=None, exists=True) -> FakeTraceabilityRepository:
        return FakeTraceabilityRepository(events=events, exists=exists)

    return _make


@pytest.fixture
def make_event_row():
    def _make(
        action: HistoryAction = HistoryAction.CAMBIO_ESTADO,
        new_status: TaskStatus | None = None,
        old_status: TaskStatus | None = None,
        due_date: datetime.date | None = None,
        created_at: datetime.datetime | None = None,
        task_title: str = "Tarea demo",
        actor_name: str | None = "Ana García",
        change_reason: str | None = None,
    ) -> TraceabilityEventRow:
        return TraceabilityEventRow(
            id=uuid4(),
            task_id=uuid4(),
            task_title=task_title,
            actor_name=actor_name,
            action=action,
            old_status=old_status,
            new_status=new_status,
            change_reason=change_reason,
            due_date=due_date,
            created_at=created_at
            or datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
        )

    return _make
