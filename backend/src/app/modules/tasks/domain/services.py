from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from starlette import status

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


class TaskService:
    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_task(self, data: "CreateTaskRequest") -> "TaskResponse":
        task_orm = self._to_orm(data)

        try:
            persisted_task = await self.repo.add(task_orm)
        except Exception as e:
            raise ValueError(f"Error interno al guardar la tarea: {str(e)}")

        return self._to_response(persisted_task)

    async def get_task_by_id(self, task_id: UUID) -> "TaskResponse":
        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La tarea con el id {task_id} no existe",
            )
        return self._to_response(task)

    async def get_tasks_by_node(self, node_id: UUID) -> list["TaskResponse"]:
        tasks = await self.repo.get_all()
        filtered_tasks = [t for t in tasks if t.node_id == node_id and not t.is_deleted]
        return [self._to_response(task) for task in filtered_tasks]

    async def update_task(
        self, task_id: UUID, data: "UpdateTaskRequest"
    ) -> "TaskResponse":
        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La tarea con el id {task_id} no existe",
            )

        updated_task = await self.repo.patch(task, data.model_dump(exclude_unset=True))
        return self._to_response(updated_task)

    async def delete_task(self, task_id: UUID) -> bool:
        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La tarea con el id {task_id} no existe",
            )

        task.soft_delete()
        return True

    @staticmethod
    def _to_orm(data: "CreateTaskRequest") -> "Task":
        # exclude_none deja que la BD aplique server_default (status, created_at).
        payload = data.model_dump(exclude_none=True)
        payload.pop("created_at", None)
        return Task(**payload)

    @staticmethod
    def _to_response(task: "Task") -> "TaskResponse":
        return TaskResponse(
            id=task.id,
            node_id=task.node_id,
            parent_task_id=task.parent_task_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            assignee_id=task.assignee_id,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status if task.status else TaskStatus.PENDIENTE_POR_INICIAR,
            completed_at=task.completed_at,
            created_at=task.created_at or datetime.now(timezone.utc),
            updated_at=getattr(task, "updated_at", None),
        )


class TaskDependencyService:
    """Gestiona dependencias finish-to-start entre tareas."""

    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_dependency(
        self, task_id: UUID, depends_on_id: UUID
    ) -> "TaskDependencyResponse":
        if rules.is_self_dependency(task_id, depends_on_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Una tarea no puede depender de sí misma",
            )

        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise HTTPException(status_code=404, detail="La tarea no existe")

        target = await self.repo.get_by_id(depends_on_id)
        if not target or target.is_deleted:
            raise HTTPException(
                status_code=404, detail="La tarea de la que se depende no existe"
            )

        if await self.repo.dependency_exists(task_id, depends_on_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La dependencia ya existe",
            )

        dependency = await self.repo.add_dependency(
            TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
        )
        return TaskDependencyResponse(
            id=dependency.id,
            task_id=dependency.task_id,
            depends_on_id=dependency.depends_on_id,
        )

    async def list_dependencies(self, task_id: UUID) -> list["TaskDependencyResponse"]:
        deps = await self.repo.get_dependencies(task_id)
        return [
            TaskDependencyResponse(
                id=d.id, task_id=d.task_id, depends_on_id=d.depends_on_id
            )
            for d in deps
        ]


class TaskStatusService:
    """Aplica las reglas de bloqueo al cambiar el estado de una tarea.

    - Finish-to-start: no se puede iniciar si una dependencia no está completada.
    - Bloqueo por fase: no se puede iniciar si una fase anterior sigue abierta.
    """

    def __init__(self, task_repo, node_repo, phase_repo):
        self.task_repo = task_repo
        self.node_repo = node_repo
        self.phase_repo = phase_repo

    async def change_status(
        self, task_id: UUID, data: "UpdateTaskStatusRequest"
    ) -> "TaskResponse":
        task = await self.task_repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise HTTPException(status_code=404, detail="La tarea no existe")

        if data.status == TaskStatus.EN_PROGRESO:
            await self._ensure_can_start(task)

        patch_data: dict = {"status": data.status}
        if data.status == TaskStatus.COMPLETADA:
            patch_data["completed_at"] = datetime.now(timezone.utc)

        updated = await self.task_repo.patch(task, patch_data)
        return TaskService._to_response(updated)

    async def _ensure_can_start(self, task: "Task") -> None:
        deps = await self.task_repo.get_dependencies(task.id)
        blocking = rules.incomplete_dependency_ids(deps)
        if blocking:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No puedes iniciar: hay dependencias sin completar",
            )

        node = await self.node_repo.get_by_id(task.node_id)
        if not node or node.phase_id is None:
            return

        phase = await self.phase_repo.get_by_id(node.phase_id)
        if not phase or phase.order_index == 0:
            return

        earlier = await self.task_repo.get_tasks_in_earlier_phases(
            project_id=node.project_id, phase_order=phase.order_index
        )
        if rules.earlier_phase_blocks(earlier):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No puedes iniciar: una fase anterior sigue abierta",
            )
