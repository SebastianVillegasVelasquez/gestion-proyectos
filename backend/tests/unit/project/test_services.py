from typing import List
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.project.domain.services import ProjectService, ProjectNodeService
from app.modules.project.infrastructure.enums import NodeType
from app.modules.project.presentation.schemas import (
    CreateProjectNodeRequest,
    UpdateProjectRequest,
)


class TestProjectServices:
    async def test_should_create_project(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)

        created_project = await service.create_project(fake_create_project_request)

        assert created_project.id is not None
        assert created_project.name == fake_create_project_request.name
        assert created_project.description == fake_create_project_request.description
        assert created_project.client_name == fake_create_project_request.client_name

        persisted_project = await fake_project_repository.get_by_id(created_project.id)
        assert persisted_project is not None
        assert persisted_project.name == fake_create_project_request.name
        assert persisted_project.description == fake_create_project_request.description
        assert persisted_project.client_name == fake_create_project_request.client_name

    @pytest.mark.asyncio
    async def test_should_create_node_chain_successfully(
        self,
        fake_project_repository,
        fake_create_project_node_chain_request: List[CreateProjectNodeRequest],
    ):
        service = ProjectNodeService(repo=fake_project_repository)

        created_nodes = await service.create_project_node(
            fake_create_project_node_chain_request
        )

        assert isinstance(created_nodes, list)

        assert len(created_nodes) == 3

        programa = created_nodes[0]
        curso = created_nodes[1]
        modulo = created_nodes[2]

        assert programa.parent_id is None

        assert curso.parent_id == programa.id
        assert curso.node_type == NodeType.CURSO

        assert modulo.parent_id == curso.id
        assert modulo.node_type == NodeType.MODULO

    @pytest.mark.asyncio
    async def test_should_create_single_node_successfully(
        self, fake_project_repository, fake_project_node: CreateProjectNodeRequest
    ):
        service = ProjectNodeService(repo=fake_project_repository)

        parent_request = CreateProjectNodeRequest(
            name="Programa Padre Académico",
            node_type=NodeType.PROGRAMA,
            project_id=fake_project_node.project_id,
        )

        persisted_parent = await service.create_project_node(parent_request)
        assert persisted_parent.id is not None  # type: ignore

        fake_project_node.parent_id = persisted_parent.id  # type: ignore

        persisted_child = await service.create_project_node(fake_project_node)

        assert persisted_child.id is not None  # type: ignore
        assert persisted_child.name == fake_project_node.name  # type: ignore
        assert persisted_child.parent_id == persisted_parent.id  # type: ignore

    async def test_should_get_all_projects(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)
        await service.create_project(fake_create_project_request)
        await service.create_project(fake_create_project_request)

        projects = await service.get_all_projects()

        assert len(projects) == 2

    async def test_should_get_project_by_id(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)
        created_project = await service.create_project(fake_create_project_request)

        fetched_project = await service.get_project_by_id(created_project.id)

        assert fetched_project.id == created_project.id
        assert fetched_project.name == fake_create_project_request.name

    async def test_should_raise_404_when_getting_non_existent_project(
        self, fake_project_repository
    ):
        service = ProjectService(fake_project_repository)
        random_uuid = uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await service.get_project_by_id(random_uuid)

        assert exc_info.value.status_code == 404

    async def test_should_update_project_partially(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)
        created_project = await service.create_project(fake_create_project_request)

        update_data = UpdateProjectRequest(name="Nuevo Nombre Modificado")

        updated_project = await service.update_project(created_project.id, update_data)

        assert updated_project.name == "Nuevo Nombre Modificado"
        assert updated_project.client_name == created_project.client_name

    async def test_should_soft_delete_project(
        self, fake_project_repository, fake_create_project_request
    ):
        service = ProjectService(fake_project_repository)

        project_response = await service.create_project(fake_create_project_request)

        created_project_orm = await fake_project_repository.get_by_id(
            project_response.id
        )

        assert created_project_orm.is_deleted is False
        assert created_project_orm.deleted_at is None

        await service.delete_project(project_response.id)

        deleted_project_in_db = await fake_project_repository.get_by_id(
            project_response.id
        )

        assert deleted_project_in_db.deleted_at is not None
        assert deleted_project_in_db.is_deleted is True
