from uuid import UUID, uuid4

import pytest

from app.modules.collaborators.infrastructure.repository import (
    CollaboratorActivity,
    CollaboratorRepository,
    CollaboratorRow,
)


class FakeCollaboratorRepository(CollaboratorRepository):
    """Repo en memoria para testear los casos de uso sin base de datos."""

    def __init__(
        self,
        rows: list[CollaboratorRow] | None = None,
        total: int = 0,
        activity: CollaboratorActivity | None = None,
    ) -> None:
        self._rows = rows or []
        self._total = total
        self._activity = activity
        self.last_call: dict | None = None

    async def list_collaborators(self, search, limit, offset):
        self.last_call = {"search": search, "limit": limit, "offset": offset}
        return self._rows, self._total

    async def get_activity(self, user_id: UUID):
        return self._activity


@pytest.fixture
def build_fake_collaborator_repo():
    def _make(rows=None, total=0, activity=None) -> FakeCollaboratorRepository:
        return FakeCollaboratorRepository(rows=rows, total=total, activity=activity)

    return _make


@pytest.fixture
def make_collaborator_row():
    def _make(
        name: str = "Ana",
        last_name: str = "García",
        position: str = "desarrollador",
        assigned_tasks: int = 0,
        completed_tasks: int = 0,
        user_id: UUID | None = None,
    ) -> CollaboratorRow:
        return CollaboratorRow(
            user_id=user_id or uuid4(),
            name=name,
            last_name=last_name,
            position=position,
            assigned_tasks=assigned_tasks,
            completed_tasks=completed_tasks,
        )

    return _make
