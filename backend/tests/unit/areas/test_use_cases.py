from uuid import uuid4

import pytest

from app.modules.areas.application.use_cases import GetProjectAreasUseCase
from app.modules.areas.presentation.schemas import ProjectAreasResponse
from app.shared.exceptions import NotFoundError


class TestGetProjectAreasUseCase:
    async def test_should_raise_not_found_when_project_missing(
        self, build_fake_area_repo
    ):
        repo = build_fake_area_repo(exists=False)
        with pytest.raises(NotFoundError):
            await GetProjectAreasUseCase(repo).execute(uuid4())

    async def test_should_compute_pct_sort_and_totals(
        self, build_fake_area_repo, make_area_row
    ):
        rows = [
            make_area_row(
                position="diseñador_grafico",
                member_count=2,
                assigned_tasks=4,
                completed_tasks=1,
            ),
            make_area_row(
                position="desarrollador",
                member_count=3,
                assigned_tasks=10,
                completed_tasks=5,
            ),
        ]
        repo = build_fake_area_repo(rows=rows)

        response = await GetProjectAreasUseCase(repo).execute(uuid4())

        assert isinstance(response, ProjectAreasResponse)
        # Ordenado por carga (más tareas asignadas primero).
        assert response.areas[0].position == "desarrollador"
        assert response.areas[0].completion_pct == 50  # 5/10
        assert response.areas[1].position == "diseñador_grafico"
        assert response.areas[1].completion_pct == 25  # 1/4
        # Totales agregados.
        assert response.total_assigned == 14
        assert response.total_completed == 6

    async def test_should_return_empty(self, build_fake_area_repo):
        repo = build_fake_area_repo(rows=[])
        response = await GetProjectAreasUseCase(repo).execute(uuid4())
        assert response.areas == []
        assert response.total_assigned == 0
