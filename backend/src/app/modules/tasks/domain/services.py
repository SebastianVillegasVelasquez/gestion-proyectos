from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskResponse,
    UpdateTaskRequest,
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
        return Task(**data.model_dump())

    @staticmethod
    def _to_response(task: "Task") -> "TaskResponse":
        return TaskResponse(
            id=task.id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            assignee_id=task.assignee_id,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status if task.status else TaskStatus.PENDIENTE_POR_INICIAR,
            completed_at=task.completed_at,
            created_at=getattr(task, "created_at", datetime.today()),
            updated_at=getattr(task, "updated_at", None),
        )
