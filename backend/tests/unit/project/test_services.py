from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.project.domain.services import ProjectService
from app.modules.project.presentation.schemas import UpdateProjectRequest


class TestProjectService:
    async def test_create_project(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)
        project = await service.create_project(fake_create_project_request)
        assert project.name == fake_create_project_request.name
        assert project.id is not None

    async def test_get_by_id_404_for_missing(self, fake_project_repository):
        service = ProjectService(fake_project_repository)
        with pytest.raises(HTTPException) as exc:
            await service.get_project_by_id(uuid4())
        assert exc.value.status_code == 404

    async def test_partial_update_keeps_other_fields(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)
        created = await service.create_project(fake_create_project_request)
        updated = await service.update_project(
            created.id, UpdateProjectRequest(name="Nuevo Nombre")
        )
        assert updated.name == "Nuevo Nombre"
        assert updated.client_name == created.client_name
