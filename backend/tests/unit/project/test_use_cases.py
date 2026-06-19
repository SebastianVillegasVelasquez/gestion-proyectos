from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.project.application.use_cases import (
    CreateProjectUseCase,
    DeleteProjectUseCase,
    GetProjectByIdUseCase,
    UpdateProjectUseCase,
)
from app.modules.project.infrastructure.models import Project
from app.modules.project.presentation.schemas import UpdateProjectRequest


class TestProjectUseCases:
    async def test_create_returns_persisted_project(
        self, fake_project_repository, fake_create_project_request
    ):
        use_case = CreateProjectUseCase(repo=fake_project_repository)
        result = await use_case.execute(fake_create_project_request)
        assert result.id is not None
        assert result.name == fake_create_project_request.name

    async def test_get_by_id_raises_404(self, fake_project_repository):
        with pytest.raises(HTTPException, match="Proyecto no encontrado") as exc:
            await GetProjectByIdUseCase(repo=fake_project_repository).execute(uuid4())
        assert exc.value.status_code == 404

    async def test_update_raises_404(self, fake_project_repository):
        with pytest.raises(HTTPException) as exc:
            await UpdateProjectUseCase(repo=fake_project_repository).execute(
                uuid4(), UpdateProjectRequest(name="Nombre válido")
            )
        assert exc.value.status_code == 404

    async def test_soft_delete_marks_project(
        self, fake_project_repository, fake_create_project_request
    ):
        project = await fake_project_repository.save(
            Project(**fake_create_project_request.model_dump())
        )
        await DeleteProjectUseCase(repo=fake_project_repository).execute(project.id)
        stored = await fake_project_repository.get_by_id(project.id)
        assert stored.deleted_at is not None and stored.is_deleted is True
