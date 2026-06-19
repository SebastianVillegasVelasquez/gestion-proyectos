from datetime import datetime, timezone
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.domain.events import TaskSubmitted
from app.modules.tasks.domain.services import (
    TaskDependencyService,
    TaskService,
    TaskStatusService,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskDependencyResponse,
    TaskResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.shared.base_repository import Repository
from app.shared.events import EventBus
from app.shared.exceptions import NotFoundError


async def _get_work_item(repo: WorkTreeRepository, work_item_id: UUID) -> WorkItem:
    item = await repo.get_item(work_item_id)
    if not item or getattr(item, "is_deleted", False):
        raise NotFoundError("El elemento del árbol de trabajo no existe")
    return item


class CreateTaskUseCase:
    """Crea una tarea que cuelga de un WorkItem (cualquier nivel del árbol)."""

    def __init__(
        self,
        task_repo: TaskRepository,
        work_tree_repo: WorkTreeRepository,
        user_repo: Repository,
    ):
        self.task_repo = task_repo
        self.work_tree_repo = work_tree_repo
        self.user_repo = user_repo
        self.service = TaskService(task_repo)

    async def execute(self, data: CreateTaskRequest) -> TaskResponse:
        await _get_work_item(self.work_tree_repo, data.work_item_id)

        if data.assignee_id:
            user = await self.user_repo.get_by_id(data.assignee_id)
            if not user or user.is_deleted:
                raise NotFoundError("El usuario asignado no existe")

        created = await self.service.add_task(data)
        if data.depends_on_id is not None:
            await TaskDependencyService(self.task_repo).add_dependency(
                created.id, data.depends_on_id
            )
        return created


class GetTasksByProjectUseCase:
    def __init__(self, task_repo: TaskRepository, project_repo: Repository):
        self.project_repo = project_repo
        self.service = TaskService(task_repo)

    async def execute(self, project_id: UUID) -> list[TaskResponse]:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise NotFoundError("El proyecto no existe")
        return await self.service.get_tasks_by_project(project_id)


class GetTasksByWorkItemUseCase:
    def __init__(self, task_repo: TaskRepository, work_tree_repo: WorkTreeRepository):
        self.work_tree_repo = work_tree_repo
        self.service = TaskService(task_repo)

    async def execute(self, work_item_id: UUID) -> list[TaskResponse]:
        await _get_work_item(self.work_tree_repo, work_item_id)
        return await self.service.get_tasks_by_work_item(work_item_id)


class GetTaskByIdUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID) -> TaskResponse:
        return await self.service.get_task_by_id(task_id)


class UpdateTaskUseCase:
    def __init__(self, task_repo: TaskRepository, user_repo: Repository):
        self.user_repo = user_repo
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID, data: UpdateTaskRequest) -> TaskResponse:
        if data.assignee_id:
            user = await self.user_repo.get_by_id(data.assignee_id)
            if not user or user.is_deleted:
                raise NotFoundError("El usuario asignado no existe")
        return await self.service.update_task(task_id, data)


class DeleteTaskUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID) -> None:
        await self.service.delete_task(task_id)


class AddTaskDependencyUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(
        self, task_id: UUID, depends_on_id: UUID
    ) -> TaskDependencyResponse:
        return await self.service.add_dependency(task_id, depends_on_id)


class GetTaskDependenciesUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(self, task_id: UUID) -> list[TaskDependencyResponse]:
        return await self.service.list_dependencies(task_id)


class ChangeTaskStatusUseCase:
    def __init__(
        self,
        task_repo: TaskRepository,
        work_tree_repo: WorkTreeRepository,
        bus: EventBus | None = None,
    ):
        self.task_repo = task_repo
        self.work_tree_repo = work_tree_repo
        self.service = TaskStatusService(task_repo)
        self._bus = bus

    async def execute(
        self, task_id: UUID, data: UpdateTaskStatusRequest
    ) -> TaskResponse:
        new_status = await self.service.change_status(task_id, data)
        assert new_status.assignee_id, "El usuario asignado debe de existir"
        if self._bus and new_status.status == TaskStatus.EN_REVISION:
            work_item = await self.work_tree_repo.get_item(new_status.work_item_id)
            await self._bus.publish(
                TaskSubmitted(
                    task_id=new_status.id,
                    project_id=work_item.proyecto_id,
                    assigned_id=new_status.assignee_id,
                    occurred_at=datetime.now(timezone.utc),
                )
            )
        return new_status
