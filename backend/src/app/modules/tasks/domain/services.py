from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.modules.tasks.domain import rules
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskDependencyResponse,
    TaskResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


class TaskService:
    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_task(self, data: "CreateTaskRequest") -> "TaskResponse":
        payload = data.model_dump(exclude_none=True)
        # Campos del request que NO son columnas del modelo.
        for field in ("duration_days", "depends_on_id"):
            payload.pop(field, None)
        return self._to_response(await self.repo.add(Task(**payload)))

    async def get_task_by_id(self, task_id: UUID) -> "TaskResponse":
        task = await self._get_active(task_id)
        return self._to_response(task, await self.repo.logged_hours(task_id))

    async def get_tasks_by_work_item(self, work_item_id: UUID) -> list["TaskResponse"]:
        return await self._with_logged_hours(
            await self.repo.get_by_work_item(work_item_id)
        )

    async def get_tasks_by_project(self, project_id: UUID) -> list["TaskResponse"]:
        return await self._with_logged_hours(
            await self.repo.get_all_by_project(project_id)
        )

    async def _with_logged_hours(self, tasks: list[Task]) -> list["TaskResponse"]:
        """Añade a cada tarea sus horas dedicadas con UNA consulta agregada.

        Preguntarlas tarea a tarea sería una consulta por fila (N+1), y estas
        listas se pintan enteras en el cronograma y en el tablero.
        """
        totals = await self.repo.logged_hours_by_task([t.id for t in tasks])
        return [self._to_response(t, totals.get(t.id, Decimal("0"))) for t in tasks]

    async def update_task(
        self, task_id: UUID, data: "UpdateTaskRequest"
    ) -> "TaskResponse":
        task = await self._get_active(task_id)
        updated = await self.repo.patch(task, data.model_dump(exclude_unset=True))
        return self._to_response(updated)

    async def delete_task(self, task_id: UUID) -> None:
        task = await self._get_active(task_id)
        task.soft_delete()

    async def _get_active(self, task_id: UUID) -> Task:
        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise NotFoundError(f"La tarea con el id {task_id} no existe")
        return task

    @staticmethod
    def _to_response(
        task: "Task", logged_hours: Decimal = Decimal("0")
    ) -> "TaskResponse":
        return TaskResponse(
            id=task.id,
            project_id=task.project_id,
            work_item_id=task.work_item_id,
            parent_task_id=task.parent_task_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            assignee_id=task.assignee_id,
            team_id=task.team_id,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status or TaskStatus.PENDIENTE_POR_INICIAR,
            completed_at=task.completed_at,
            created_at=task.created_at or datetime.now(timezone.utc),
            updated_at=getattr(task, "updated_at", None),
            estimated_hours=task.estimated_hours,
            logged_hours=logged_hours,
        )


class TaskDependencyService:
    """Dependencias finish-to-start entre tareas."""

    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_dependency(
        self, task_id: UUID, depends_on_id: UUID
    ) -> "TaskDependencyResponse":
        if rules.is_self_dependency(task_id, depends_on_id):
            raise ConflictError("Una tarea no puede depender de sí misma")

        for tid, name in ((task_id, "tarea"), (depends_on_id, "tarea origen")):
            t = await self.repo.get_by_id(tid)
            if not t or t.is_deleted:
                raise NotFoundError(f"La {name} no existe")

        if await self.repo.dependency_exists(task_id, depends_on_id):
            raise ConflictError("La dependencia ya existe")

        dep = await self.repo.add_dependency(
            TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
        )
        return TaskDependencyResponse(
            id=dep.id, task_id=dep.task_id, depends_on_id=dep.depends_on_id
        )

    async def list_dependencies(self, task_id: UUID) -> list["TaskDependencyResponse"]:
        return [
            TaskDependencyResponse(
                id=d.id, task_id=d.task_id, depends_on_id=d.depends_on_id
            )
            for d in await self.repo.get_dependencies(task_id)
        ]

    async def list_dependencies_by_project(
        self, project_id: UUID
    ) -> list["TaskDependencyResponse"]:
        return [
            TaskDependencyResponse(
                id=d.id, task_id=d.task_id, depends_on_id=d.depends_on_id
            )
            for d in await self.repo.get_dependencies_by_project(project_id)
        ]


class TaskStatusService:
    """Cambia el estado de una tarea aplicando la regla FtS.

    El "bloqueo por fase anterior" que existía antes desaparece: el orden entre
    fases ahora es una dependencia FtS sobre el WorkItem (motor del slice 2),
    no una regla aparte en tasks.
    """

    def __init__(self, task_repo):
        self.task_repo = task_repo

    async def change_status(
        self, task_id: UUID, data: "UpdateTaskStatusRequest"
    ) -> "TaskResponse":
        task = await self.task_repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        if data.status == TaskStatus.EN_PROGRESO:
            deps = await self.task_repo.get_dependencies(task.id)
            if rules.incomplete_dependency_ids(deps):
                raise ValidationError(
                    "No puedes iniciar: hay dependencias sin completar"
                )

        patch: dict = {"status": data.status}
        if data.status == TaskStatus.COMPLETADA:
            patch["completed_at"] = datetime.now(timezone.utc)

        updated = await self.task_repo.patch(task, patch)
        assert updated is not None
        return TaskService._to_response(updated)
