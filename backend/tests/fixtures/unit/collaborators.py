from uuid import UUID, uuid4

import pytest

from app.modules.collaborators.domain.models import (
    CollaboratorCounts,
    CollaboratorHistoryRead,
    CollaboratorIdentity,
    CollaboratorRow,
    CollaboratorTaskRead,
)
from app.modules.collaborators.domain.repository import CollaboratorRepository


class FakeCollaboratorRepository(CollaboratorRepository):
    """Repo en memoria para testear el servicio/casos de uso sin base de datos."""

    def __init__(
        self,
        rows: list[CollaboratorRow] | None = None,
        total: int = 0,
        identity: CollaboratorIdentity | None = None,
        counts: CollaboratorCounts | None = None,
        project_count: int = 0,
        team_count: int = 0,
        tasks: list[CollaboratorTaskRead] | None = None,
        history: list[CollaboratorHistoryRead] | None = None,
    ) -> None:
        self._rows = rows or []
        self._total = total
        self._identity = identity
        self._counts = counts or CollaboratorCounts()
        self._project_count = project_count
        self._team_count = team_count
        self._tasks = tasks or []
        self._history = history or []
        self.last_call: dict | None = None

    async def count_collaborators(self, search: str | None) -> int:
        return self._total

    async def list_collaborator_rows(self, search, limit, offset):
        self.last_call = {"search": search, "limit": limit, "offset": offset}
        return self._rows

    async def get_identity(self, user_id: UUID):
        return self._identity

    async def get_status_counts(self, user_id: UUID) -> CollaboratorCounts:
        return self._counts

    async def count_projects(self, user_id: UUID) -> int:
        return self._project_count

    async def count_teams(self, user_id: UUID) -> int:
        return self._team_count

    async def list_assigned_tasks(self, user_id: UUID, limit: int):
        return self._tasks

    async def list_history(self, user_id: UUID, limit: int):
        return self._history


@pytest.fixture
def build_fake_collaborator_repo():
    def _make(**kwargs) -> FakeCollaboratorRepository:
        return FakeCollaboratorRepository(**kwargs)

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
