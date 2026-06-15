from datetime import timedelta, date, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import NodeType
from app.modules.project.infrastructure.models import ProjectNode, Project
from app.modules.tasks.application.use_cases import (
    CreateTaskUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
)
from app.modules.tasks.domain.services import TaskService
from app.modules.tasks.infrastructure.enums import TaskStatus, TaskPriority
from app.modules.tasks.infrastructure.models import Task
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskResponse,
    UpdateTaskRequest,
)


class TestTaskServices:
    async def test_should_create_task_successfully(self, fake_task_repo):
        service = TaskService(repo=fake_task_repo)

        valid_start_date = date.today()
        valid_due_date = date.today() + timedelta(days=5)
        fake_assignee_id = uuid4()

        valid_request = CreateTaskRequest(
            title="Diseñar diagrama de base de datos",
            description="Crear el diagrama ER para el nuevo módulo",
            priority=TaskPriority.ALTA,
            assignee_id=fake_assignee_id,
            start_date=valid_start_date,
            due_date=valid_due_date,
            status=TaskStatus.PENDIENTE_POR_INICIAR,
        )

        response = await service.add_task(valid_request)

        assert isinstance(response, TaskResponse)
        assert response.id is not None
        assert response.title == "Diseñar diagrama de base de datos"
        assert response.status == TaskStatus.PENDIENTE_POR_INICIAR

        persisted_task = await fake_task_repo.get_by_id(response.id)
        assert persisted_task is not None
        assert persisted_task.title == valid_request.title

    async def test_should_fail_when_due_date_is_before_start_date(self):
        invalid_start_date = date.today() + timedelta(days=5)
        invalid_due_date = date.today() + timedelta(days=2)

        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title="Tarea temporalmente imposible",
                start_date=invalid_start_date,
                due_date=invalid_due_date,
                priority=TaskPriority.ALTA,
            )

        assert "La fecha límite no puede ser menor a la fecha de inicio" in str(
            exc_info.value
        )

    async def test_should_allow_past_start_date(self):
        # La regla de "no iniciar en el pasado" se eliminó para dar flexibilidad
        # (registrar trabajo ya iniciado, sembrar tareas vencidas, etc.).
        past_start_date = date.today() - timedelta(days=3)
        valid_due_date = date.today() + timedelta(days=5)

        request = CreateTaskRequest(
            title="Tarea del pasado",
            start_date=past_start_date,
            due_date=valid_due_date,
        )
        assert request.start_date == past_start_date

    async def test_should_compute_due_date_from_duration(self):
        start = date.today()
        request = CreateTaskRequest(
            title="Tarea por duración",
            start_date=start,
            duration_days=10,
        )
        assert request.due_date == start + timedelta(days=10)

    async def test_should_create_task_via_use_case(
        self,
        fake_task_repo,
        fake_project_repository,
        fake_project_node_repository,
        fake_user_repo,
        fake_phase_repository,
    ):
        project_orm = Project(id=uuid4(), name="Proyecto Prueba")
        persisted_project = await fake_project_repository.save(project_orm)

        node_orm = ProjectNode(
            id=uuid4(),
            name="Nodo Prueba",
            node_type=NodeType.PROGRAMA,
            project_id=persisted_project.id,
        )
        persisted_node = await fake_project_node_repository.save(node_orm)

        user_orm = User(
            id=uuid4(),
            name="John",
            email="john@test.com",
            password="hash",
            role=SystemRole.USER,
            position=UserPosition.DESARROLLADOR,
        )
        persisted_user = await fake_user_repo.save(user_orm)

        use_case = CreateTaskUseCase(
            user_repo=fake_user_repo,
            project_repo=fake_project_repository,
            project_node_repo=fake_project_node_repository,
            task_repo=fake_task_repo,
            phase_repo=fake_phase_repository,
        )

        request = CreateTaskRequest(
            title="Integración de DB",
            node_id=persisted_node.id,
            assignee_id=persisted_user.id,
            start_date=date.today(),
            due_date=date.today() + timedelta(days=2),
        )

        response = await use_case.execute(project_id=persisted_project.id, data=request)

        assert response.title == "Integración de DB"
        assert response.assignee_id == persisted_user.id

    async def test_should_fail_create_task_when_node_not_found(
        self,
        fake_task_repo,
        fake_project_repository,
        fake_project_node_repository,
        fake_user_repo,
        fake_phase_repository,
    ):
        project_orm = Project(id=uuid4(), name="Proyecto Prueba")
        persisted_project = await fake_project_repository.save(project_orm)

        use_case = CreateTaskUseCase(
            user_repo=fake_user_repo,
            project_repo=fake_project_repository,
            project_node_repo=fake_project_node_repository,
            task_repo=fake_task_repo,
            phase_repo=fake_phase_repository,
        )

        request = CreateTaskRequest(
            title="Tarea sin nodo",
            node_id=uuid4(),
            start_date=date.today(),
            due_date=date.today() + timedelta(days=2),
        )

        with pytest.raises(HTTPException, match="El nodo no existe en este proyecto"):
            await use_case.execute(project_id=persisted_project.id, data=request)

    async def test_should_update_task(
        self,
        fake_task_repo,
        fake_project_repository,
        fake_project_node_repository,
        fake_user_repo,
    ):
        project_orm = Project(id=uuid4(), name="Proyecto Prueba")
        persisted_project = await fake_project_repository.save(project_orm)

        node_orm = ProjectNode(
            id=uuid4(),
            name="Nodo Prueba",
            node_type=NodeType.PROGRAMA,
            project_id=persisted_project.id,
        )
        persisted_node = await fake_project_node_repository.save(node_orm)

        task_orm = Task(
            id=uuid4(),
            title="Original",
            start_date=date.today(),
            due_date=date.today(),
            node_id=persisted_node.id,
            created_at=datetime.today(),
            status=TaskStatus.PENDIENTE_POR_INICIAR,
            priority=TaskPriority.MEDIA,
        )

        persisted_task = await fake_task_repo.save(task_orm)

        use_case = UpdateTaskUseCase(
            fake_task_repo,
            fake_project_repository,
            fake_user_repo,
            fake_project_node_repository,
        )

        update_request = UpdateTaskRequest(title="Modificado")

        response = await use_case.execute(
            project_id=persisted_project.id,
            node_id=persisted_node.id,
            task_id=persisted_task.id,
            data=update_request,
        )

        assert response.title == "Modificado"

    @pytest.mark.skip(reason="No se puede modificar el estado de una tarea")
    async def test_should_delete_task(
        self, fake_task_repo, fake_project_repository, fake_project_node_repository
    ):
        project_orm = Project(id=uuid4(), name="Proyecto Prueba")
        persisted_project = await fake_project_repository.save(project_orm)

        node_orm = ProjectNode(
            id=uuid4(),
            name="Nodo Prueba",
            node_type=NodeType.PROGRAMA,
            project_id=persisted_project.id,
        )
        persisted_node = await fake_project_node_repository.save(node_orm)

        task_orm = Task(
            id=uuid4(),
            title="A borrar",
            start_date=date.today(),
            due_date=date.today(),
            node_id=persisted_node.id,
            status=TaskStatus.PENDIENTE_POR_INICIAR,
            priority=TaskPriority.MEDIA,
        )

        persisted_task = await fake_task_repo.save(task_orm)

        use_case = DeleteTaskUseCase(
            fake_task_repo, fake_project_repository, fake_project_node_repository
        )

        await use_case.execute(
            project_id=persisted_project.id,
            node_id=persisted_node.id,
            task_id=persisted_task.id,
        )

        deleted_task = await fake_task_repo.get_by_id(persisted_task.id)

        assert deleted_task.is_deleted is True


# class TestTaskUseCases:
#
#     async def test_should_create_task_via_use_case(
#             self,
#             fake_task_repo,
#             fake_project_repo,
#             fake_project_node_repo,
#             fake_user_repo
#     ):
#         project_orm = Project(id=uuid4(), name="Proyecto Prueba")
#         persisted_project = await fake_project_repo.save(project_orm)
#
#         node_orm = ProjectNode(id=uuid4(), name="Nodo Prueba", node_type=NodeType.PROGRAMA,
#                                project_id=persisted_project.id)
#         persisted_node = await fake_project_node_repo.save(node_orm)
#
#         user_orm = User(id=uuid4(), name="John", email="john@test.com", password="hash", role=SystemRole.USER,
#                         position=UserPosition.DESARROLLADOR)
#         persisted_user = await fake_user_repo.save(user_orm)
#
#         use_case = CreateTaskUseCase(fake_task_repo, fake_project_repo, fake_project_node_repo, fake_user_repo)
#
#         request = CreateTaskRequest(
#             title="Integración de DB",
#             assignee_id=persisted_user.id,
#             start_date=date.today(),
#             created_at=datetime.today(),
#             due_date=date.today() + timedelta(days=2)
#         )
#
#         response = await use_case.execute(
#             project_id=persisted_project.id,
#             node_id=persisted_node.id,
#             data=request
#         )
#
#         assert response.title == "Integración de DB"
#         assert response.assignee_id == persisted_user.id
#
#     async def test_should_fail_create_task_when_node_not_found(
#             self,
#             fake_task_repo,
#             fake_project_repo,
#             fake_project_node_repo,
#             fake_user_repo
#     ):
#         project_orm = Project(id=uuid4(), name="Proyecto Prueba")
#         persisted_project = await fake_project_repo.save(project_orm)
#
#         use_case = CreateTaskUseCase(fake_task_repo, fake_project_repo, fake_project_node_repo, fake_user_repo)
#
#         request = CreateTaskRequest(
#             title="Tarea sin nodo",
#             start_date=date.today(),
#             created_at=datetime.today(),
#             due_date=date.today() + timedelta(days=2)
#         )
#
#         invalid_node_id = uuid4()
#
#         with pytest.raises(HTTPException) as exc_info:
#             await use_case.execute(
#                 project_id=persisted_project.id,
#                 node_id=invalid_node_id,
#                 data=request
#             )
#
#         assert str(invalid_node_id) in exc_info.value.detail
#         assert exc_info.value.status_code == 404
#
#     async def test_should_update_task(
#             self,
#             fake_task_repo,
#             fake_project_repo,
#             fake_project_node_repo,
#             fake_user_repo
#     ):
#         project_orm = Project(id=uuid4(), name="Proyecto Prueba")
#         persisted_project = await fake_project_repo.save(project_orm)
#
#         node_orm = ProjectNode(id=uuid4(), name="Nodo Prueba", node_type=NodeType.PROGRAMA,
#                                project_id=persisted_project.id)
#         persisted_node = await fake_project_node_repo.save(node_orm)
#
#         task_orm = Task(id=uuid4(), title="Original", start_date=date.today(), due_date=date.today(),
#                         node_id=persisted_node.id, status=TaskStatus.PENDIENTE_POR_INICIAR, priority=TaskPriority.MEDIA)
#         persisted_task = await fake_task_repo.save(task_orm)
#
#         use_case = UpdateTaskUseCase(fake_task_repo, fake_project_repo, fake_project_node_repo, fake_user_repo)
#         update_request = UpdateTaskRequest(title="Modificado")
#
#         response = await use_case.execute(
#             project_id=persisted_project.id,
#             node_id=persisted_node.id,
#             task_id=persisted_task.id,
#             data=update_request
#         )
#
#         assert response.title == "Modificado"
#
#     async def test_should_delete_task(
#             self,
#             fake_task_repo,
#             fake_project_repo,
#             fake_project_node_repo
#     ):
#         project_orm = Project(id=uuid4(), name="Proyecto Prueba")
#         persisted_project = await fake_project_repo.save(project_orm)
#
#         node_orm = ProjectNode(id=uuid4(), name="Nodo Prueba", node_type=NodeType.PROGRAMA,
#                                project_id=persisted_project.id)
#         persisted_node = await fake_project_node_repo.save(node_orm)
#
#         task_orm = Task(id=uuid4(), title="A borrar", start_date=date.today(), due_date=date.today(),
#                         node_id=persisted_node.id, status=TaskStatus.PENDIENTE_POR_INICIAR, priority=TaskPriority.MEDIA)
#         persisted_task = await fake_task_repo.save(task_orm)
#
#         use_case = DeleteTaskUseCase(fake_task_repo, fake_project_repo, fake_project_node_repo)
#
#         await use_case.execute(
#             project_id=persisted_project.id,
#             node_id=persisted_node.id,
#             task_id=persisted_task.id
#         )
#
#         deleted_task = await fake_task_repo.get_by_id(persisted_task.id)
#         assert deleted_task.is_deleted is True
