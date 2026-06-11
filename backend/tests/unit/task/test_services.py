import datetime
from datetime import timedelta, date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.tasks.domain.services import TaskService
from app.modules.tasks.infrastructure.enums import TaskStatus, TaskPriority
from app.modules.tasks.presentation.schemas import CreateTaskRequest, TaskResponse


class TestTaskServices:
    async def test_should_create_task_successfully(self, fake_task_repo):
        service = TaskService(repo=fake_task_repo)

        valid_start_date = date.today()
        valid_due_date = date.today() + timedelta(days=5)
        fake_node_id = uuid4()
        fake_assignee_id = uuid4()

        valid_request = CreateTaskRequest(
            title="Diseñar diagrama de base de datos",
            description="Crear el diagrama ER para el nuevo módulo",
            priority=TaskPriority.ALTA,
            node_id=fake_node_id,
            assignee_id=fake_assignee_id,
            start_date=valid_start_date,
            due_date=valid_due_date,
            status=TaskStatus.PENDIENTE_POR_INICIAR,
            created_at=datetime.today(),
        )

        response = await service.add_task(valid_request)

        assert isinstance(response, TaskResponse)
        assert response.id is not None
        assert response.title == "Diseñar diagrama de base de datos"
        assert response.node_id == fake_node_id
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
                node_id=uuid4(),
                start_date=invalid_start_date,
                due_date=invalid_due_date,
                priority=TaskPriority.ALTA,
            )

        assert "La fecha límite no puede ser menor a la fecha de inicio" in str(
            exc_info.value
        )

    async def test_should_fail_when_start_date_is_in_the_past(self):
        past_start_date = date.today() - timedelta(days=3)
        valid_due_date = date.today() + timedelta(days=5)

        with pytest.raises(ValidationError) as exc_info:
            CreateTaskRequest(
                title="Tarea del pasado",
                node_id=uuid4(),
                start_date=past_start_date,
                due_date=valid_due_date,
            )

        assert (
            "La fecha de inicio de la tarea no puede ser menor a la fecha actual"
            in str(exc_info.value)
        )
