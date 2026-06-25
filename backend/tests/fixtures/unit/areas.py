from uuid import UUID

import pytest

from app.modules.areas.infrastructure.repository import AreaRepository, AreaRow


class FakeAreaRepository(AreaRepository):
    def __init__(self, rows: list[AreaRow] | None = None, exists: bool = True) -> None:
        self._rows = rows or []
        self._exists = exists

    async def project_exists(self, project_id: UUID) -> bool:
        return self._exists

    async def area_rows(self, project_id: UUID) -> list[AreaRow]:
        return self._rows


@pytest.fixture
def build_fake_area_repo():
    def _make(rows=None, exists=True) -> FakeAreaRepository:
        return FakeAreaRepository(rows=rows, exists=exists)

    return _make


@pytest.fixture
def make_area_row():
    def _make(
        position: str = "desarrollador",
        member_count: int = 1,
        assigned_tasks: int = 0,
        completed_tasks: int = 0,
    ) -> AreaRow:
        return AreaRow(
            position=position,
            member_count=member_count,
            assigned_tasks=assigned_tasks,
            completed_tasks=completed_tasks,
        )

    return _make
