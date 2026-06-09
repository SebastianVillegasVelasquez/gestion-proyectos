from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.project.application.use_cases import (
    CreateProjectUseCase,
    CreateProjectNodeUseCase,
    GetProjectsUseCase,
    GetProjectByIdUseCase,
    UpdateProjectUseCase,
    DeleteProjectUseCase,
)
from app.modules.project.infrastructure.enums import NodeType
from app.modules.project.infrastructure.models import Project
from app.modules.project.presentation.schemas import (
    CreateProjectNodeRequest,
    UpdateProjectRequest,
)


class TestProjectUseCases:
    async def test_create_project_use_case(
        self, fake_project_repository, fake_create_project_request
    ):
        use_case = CreateProjectUseCase(repo=fake_project_repository)

        persisted_project = await use_case.execute(fake_create_project_request)

        assert persisted_project.id is not None
        assert persisted_project.name == fake_create_project_request.name
        assert persisted_project.description == fake_create_project_request.description
        assert persisted_project.client_name == fake_create_project_request.client_name
        assert persisted_project.start_date == fake_create_project_request.start_date
        assert persisted_project.end_date == fake_create_project_request.end_date

    async def test_should_get_all_projects_empty(self, fake_project_repository):
        """Debe retornar una lista vacía si no hay proyectos creados."""
        # Arrange
        use_case = GetProjectsUseCase(repo=fake_project_repository)

        # Act
        result = await use_case.execute()

        # Assert
        assert isinstance(result, list)
        assert len(result) == 0

    async def test_should_get_all_projects_successfully(
        self, fake_project_repository, fake_create_project_request
    ):
        """Debe retornar todos los proyectos persistidos en el repositorio."""
        # Arrange
        # Guardamos dos proyectos directamente en el repositorio fake
        project1 = Project(**fake_create_project_request.model_dump())
        project2 = Project(**fake_create_project_request.model_dump())
        project2.name = "Otro Proyecto Académico"

        await fake_project_repository.save(project1)
        await fake_project_repository.save(project2)

        use_case = GetProjectsUseCase(repo=fake_project_repository)

        # Act
        result = await use_case.execute()

        # Assert
        assert len(result) == 2
        assert result[0].name == fake_create_project_request.name
        assert result[1].name == "Otro Proyecto Académico"

    # ==========================================
    # TESTS PARA GET PROJECT BY ID USE CASE
    # ==========================================
    async def test_should_get_project_by_id_successfully(
        self, fake_project_repository, fake_create_project_request
    ):
        """Debe retornar el proyecto correspondiente al ID solicitado."""
        # Arrange
        project_orm = Project(**fake_create_project_request.model_dump())
        saved_project = await fake_project_repository.save(project_orm)

        use_case = GetProjectByIdUseCase(repo=fake_project_repository)

        # Act
        result = await use_case.execute(saved_project.id)

        # Assert
        assert result is not None
        assert result.id == saved_project.id
        assert result.name == saved_project.name

    async def test_should_raise_404_when_project_by_id_not_found(
        self, fake_project_repository
    ):
        """Debe lanzar un error 404 si el ID no existe en el repositorio."""
        # Arrange
        use_case = GetProjectByIdUseCase(repo=fake_project_repository)
        random_id = uuid4()

        with pytest.raises(HTTPException, match="Proyecto no encontrado") as exc_info:
            await use_case.execute(random_id)

        assert exc_info.value.status_code == 404

    async def test_should_update_project_successfully(
        self, fake_project_repository, fake_create_project_request
    ):
        project_orm = Project(**fake_create_project_request.model_dump())
        saved_project = await fake_project_repository.save(project_orm)

        use_case = UpdateProjectUseCase(repo=fake_project_repository)

        update_request = UpdateProjectRequest(
            name="Nombre Totalmente Modificado", client_name="Unicafam Modificado"
        )

        result = await use_case.execute(saved_project.id, update_request)

        assert result.name == "Nombre Totalmente Modificado"
        assert result.client_name == "Unicafam Modificado"
        assert result.description == fake_create_project_request.description

        persisted_orm = await fake_project_repository.get_by_id(saved_project.id)
        assert persisted_orm.name == "Nombre Totalmente Modificado"
        assert persisted_orm.client_name == "Unicafam Modificado"

    async def test_should_raise_404_when_updating_non_existent_project(
        self, fake_project_repository
    ):
        use_case = UpdateProjectUseCase(repo=fake_project_repository)
        update_request = UpdateProjectRequest(name="Prueba")
        random_id = uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await use_case.execute(random_id, update_request)

        assert exc_info.value.status_code == 404

    async def test_should_soft_delete_project_successfully(
        self, fake_project_repository, fake_create_project_request
    ):
        project_orm = Project(**fake_create_project_request.model_dump())
        saved_project = await fake_project_repository.save(project_orm)

        use_case = DeleteProjectUseCase(repo=fake_project_repository)

        await use_case.execute(saved_project.id)

        deleted_project_orm = await fake_project_repository.get_by_id(saved_project.id)

        assert deleted_project_orm is not None
        assert deleted_project_orm.deleted_at is not None
        assert deleted_project_orm.is_deleted is True

    async def test_should_raise_404_when_deleting_non_existent_project(
        self, fake_project_repository
    ):
        use_case = DeleteProjectUseCase(repo=fake_project_repository)
        random_id = uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await use_case.execute(random_id)

        assert exc_info.value.status_code == 404


class TestProjectNodeUseCases:
    async def test_should_create_node_when_project_exists(
        self, fake_project_repository, fake_project_node_repository
    ):
        project_id = uuid4()
        existing_project = Project(id=project_id, name="Proyecto Unicafam")
        await fake_project_repository.save(existing_project)

        use_case = CreateProjectNodeUseCase(
            node_repo=fake_project_node_repository, project_repo=fake_project_repository
        )

        node_request = CreateProjectNodeRequest(
            name="Especialización en Salud",
            node_type=NodeType.PROGRAMA,
            project_id=project_id,
        )

        created_nodes = await use_case.execute(node_request)

        assert created_nodes is not None
        assert created_nodes.name == "Especialización en Salud"
        assert created_nodes.project_id == project_id

        persisted_node = await fake_project_node_repository.get_by_id(created_nodes.id)
        assert persisted_node is not None
