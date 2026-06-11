from datetime import datetime

from app.modules.tasks.infrastructure.models import Task
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import CreateTaskRequest, TaskResponse


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
            node_id=task.node_id,
            assignee_id=task.assignee_id,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status,
            completed_at=task.completed_at,
            created_at=getattr(task, "created_at", datetime.now()),
            updated_at=getattr(task, "updated_at", None),
        )
