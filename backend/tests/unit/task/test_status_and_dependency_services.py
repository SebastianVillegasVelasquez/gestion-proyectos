import datetime
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.tasks.domain.services import (
    TaskDependencyService,
    TaskStatusService,
)
from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.modules.tasks.presentation.schemas import UpdateTaskStatusRequest


class FakeTaskRepo:
    def __init__(self):
        self.tasks: dict[uuid.UUID, Task] = {}
        self.deps: list[TaskDependency] = []
        self.earlier_phase_tasks: list = []

    async def get_by_id(self, task_id):
        return self.tasks.get(task_id)

    async def get_dependencies(self, task_id):
        return [d for d in self.deps if d.task_id == task_id]

    async def dependency_exists(self, task_id, depends_on_id):
        return any(
            d.task_id == task_id and d.depends_on_id == depends_on_id for d in self.deps
        )

    async def add_dependency(self, dependency: TaskDependency):
        dependency.id = uuid.uuid4()
        self.deps.append(dependency)
        return dependency

    async def get_tasks_in_earlier_phases(self, project_id, phase_order):
        return self.earlier_phase_tasks

    async def patch(self, entity: Task, data: dict):
        for k, v in data.items():
            setattr(entity, k, v)
        return entity


def _make_task(status=TaskStatus.PENDIENTE_POR_INICIAR, node_id=None):
    task = Task(title="Tarea de prueba", node_id=node_id or uuid.uuid4())
    task.id = uuid.uuid4()
    task.status = status
    task.priority = TaskPriority.MEDIA
    task.start_date = datetime.date.today()
    task.due_date = datetime.date.today() + datetime.timedelta(days=5)
    task.description = None
    task.assignee_id = None
    task.created_at = None
    task.updated_at = None
    task.deleted_at = None
    task.completed_at = None
    task.parent_task_id = None
    return task


class TestTaskDependencyService:
    async def test_should_reject_self_dependency(self):
        repo = FakeTaskRepo()
        task = _make_task()
        repo.tasks[task.id] = task
        service = TaskDependencyService(repo)

        with pytest.raises(HTTPException) as exc:
            await service.add_dependency(task.id, task.id)
        assert exc.value.status_code == 409

    async def test_should_reject_when_duplicate(self):
        repo = FakeTaskRepo()
        a, b = _make_task(), _make_task()
        repo.tasks[a.id] = a
        repo.tasks[b.id] = b
        repo.deps.append(TaskDependency(task_id=a.id, depends_on_id=b.id))
        service = TaskDependencyService(repo)

        with pytest.raises(HTTPException) as exc:
            await service.add_dependency(a.id, b.id)
        assert exc.value.status_code == 409

    async def test_should_create_dependency(self):
        repo = FakeTaskRepo()
        a, b = _make_task(), _make_task()
        repo.tasks[a.id] = a
        repo.tasks[b.id] = b
        service = TaskDependencyService(repo)

        result = await service.add_dependency(a.id, b.id)
        assert result.task_id == a.id
        assert result.depends_on_id == b.id


class TestTaskStatusService:
    def _service(self, repo, node=None, phase=None):
        node_repo = SimpleNamespace(get_by_id=lambda _id: _async(node))
        phase_repo = SimpleNamespace(get_by_id=lambda _id: _async(phase))
        return TaskStatusService(repo, node_repo, phase_repo)

    async def test_should_block_start_when_dependency_incomplete(self):
        repo = FakeTaskRepo()
        task = _make_task()
        prereq = _make_task(status=TaskStatus.EN_PROGRESO)
        repo.tasks[task.id] = task
        dep = TaskDependency(task_id=task.id, depends_on_id=prereq.id)
        dep.depends_on = prereq
        repo.deps.append(dep)

        service = self._service(repo)
        with pytest.raises(HTTPException) as exc:
            await service.change_status(
                task.id, UpdateTaskStatusRequest(status=TaskStatus.EN_PROGRESO)
            )
        assert exc.value.status_code == 409

    async def test_should_allow_start_when_dependencies_completed(self):
        repo = FakeTaskRepo()
        node = SimpleNamespace(phase_id=None, project_id=uuid.uuid4())
        task = _make_task(node_id=uuid.uuid4())
        prereq = _make_task(status=TaskStatus.COMPLETADA)
        repo.tasks[task.id] = task
        dep = TaskDependency(task_id=task.id, depends_on_id=prereq.id)
        dep.depends_on = prereq
        repo.deps.append(dep)

        service = self._service(repo, node=node)
        result = await service.change_status(
            task.id, UpdateTaskStatusRequest(status=TaskStatus.EN_PROGRESO)
        )
        assert result.status == TaskStatus.EN_PROGRESO

    async def test_should_block_when_earlier_phase_open(self):
        repo = FakeTaskRepo()
        node = SimpleNamespace(phase_id=uuid.uuid4(), project_id=uuid.uuid4())
        phase = SimpleNamespace(order_index=1)
        repo.earlier_phase_tasks = [_make_task(status=TaskStatus.EN_PROGRESO)]
        task = _make_task()
        repo.tasks[task.id] = task

        service = self._service(repo, node=node, phase=phase)
        with pytest.raises(HTTPException) as exc:
            await service.change_status(
                task.id, UpdateTaskStatusRequest(status=TaskStatus.EN_PROGRESO)
            )
        assert exc.value.status_code == 409

    async def test_should_set_completed_at_on_completion(self):
        repo = FakeTaskRepo()
        task = _make_task()
        repo.tasks[task.id] = task

        service = self._service(repo)
        result = await service.change_status(
            task.id, UpdateTaskStatusRequest(status=TaskStatus.COMPLETADA)
        )
        assert result.status == TaskStatus.COMPLETADA
        assert result.completed_at is not None


async def _async(value):
    return value
