from uuid import uuid4

import pytest

from app.modules.collaborators.application.use_cases import (
    GetCollaboratorActivityUseCase,
    ListCollaboratorsUseCase,
)
from app.modules.collaborators.infrastructure.repository import CollaboratorActivity
from app.modules.collaborators.presentation.schemas import (
    CollaboratorActivityResponse,
    PaginatedCollaboratorsResponse,
)
from app.shared.exceptions import NotFoundError
from app.shared.pagination import Pagination


class TestListCollaboratorsUseCase:
    async def test_should_compute_completion_pct_per_row(
        self, build_fake_collaborator_repo, make_collaborator_row
    ):
        rows = [
            make_collaborator_row(name="Ana", assigned_tasks=10, completed_tasks=5),
            make_collaborator_row(name="Beto", assigned_tasks=0, completed_tasks=0),
        ]
        repo = build_fake_collaborator_repo(rows=rows, total=2)

        response = await ListCollaboratorsUseCase(repo).execute(
            search=None, pagination=Pagination.of(page=1, page_size=10)
        )

        assert isinstance(response, PaginatedCollaboratorsResponse)
        assert response.total == 2
        assert response.items[0].completion_pct == 50  # 5/10
        assert response.items[1].completion_pct == 0  # sin tareas

    async def test_should_pass_pagination_bounds_to_repository(
        self, build_fake_collaborator_repo
    ):
        repo = build_fake_collaborator_repo(rows=[], total=0)

        await ListCollaboratorsUseCase(repo).execute(
            search="ana", pagination=Pagination.of(page=3, page_size=10)
        )

        assert repo.last_call == {"search": "ana", "limit": 10, "offset": 20}

    async def test_should_return_empty_page(self, build_fake_collaborator_repo):
        repo = build_fake_collaborator_repo(rows=[], total=0)

        response = await ListCollaboratorsUseCase(repo).execute(
            search=None, pagination=Pagination.of()
        )

        assert response.items == []
        assert response.total == 0


class TestGetCollaboratorActivityUseCase:
    async def test_should_raise_not_found_when_missing(
        self, build_fake_collaborator_repo
    ):
        repo = build_fake_collaborator_repo(activity=None)

        with pytest.raises(NotFoundError):
            await GetCollaboratorActivityUseCase(repo).execute(uuid4())

    async def test_should_return_activity_with_completion_pct(
        self, build_fake_collaborator_repo
    ):
        activity = CollaboratorActivity(
            user_id=uuid4(),
            name="Ana",
            last_name="García",
            email="ana@acme.com",
            position="desarrollador",
            assigned_tasks=8,
            completed_tasks=2,
            in_progress_tasks=3,
            project_count=2,
            team_count=1,
            tasks=[],
            history=[],
        )
        repo = build_fake_collaborator_repo(activity=activity)

        response = await GetCollaboratorActivityUseCase(repo).execute(activity.user_id)

        assert isinstance(response, CollaboratorActivityResponse)
        assert response.completion_pct == 25  # 2/8
        assert response.project_count == 2
        assert response.team_count == 1
        assert response.tasks == []
        assert response.history == []
