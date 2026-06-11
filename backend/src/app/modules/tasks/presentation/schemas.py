from datetime import date, datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints, model_validator

from app.modules.tasks.infrastructure.enums import (
    TaskPriority,
    TaskStatus,
    HistoryAction,
)
from app.shared.base_model import BaseModelConfig


class TaskBase(BaseModelConfig):
    title: Annotated[str, StringConstraints(min_length=2, max_length=200)]
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIA
    assignee_id: Optional[UUID] = None
    start_date: date
    due_date: date
    status: Optional[TaskStatus] = None
    created_at: Optional[datetime] = None


class CreateTaskRequest(TaskBase):
    @model_validator(mode="after")
    def validate_task_dates(self) -> "CreateTaskRequest":
        # 1. Validar orden cronológico de la tarea
        if self.due_date < self.start_date:
            raise ValueError("La fecha límite no puede ser menor a la fecha de inicio")

        # 2. Validar que no inicie en el pasado
        if self.start_date < date.today():
            raise ValueError(
                "La fecha de inicio de la tarea no puede ser menor a la fecha actual"
            )

        return self


class TaskResponse(TaskBase):
    id: UUID
    status: TaskStatus
    completed_at: Optional[datetime] = None
    created_at: datetime = datetime.today()
    updated_at: Optional[datetime] = None


class UpdateTaskStatusRequest(BaseModelConfig):
    status: TaskStatus
    change_reason: Optional[str] = None


class UpdateTaskRequest(BaseModelConfig):
    title: Optional[Annotated[str, StringConstraints(min_length=2, max_length=200)]] = (
        None
    )
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[UUID] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None


###############
# Task History
###############


class UserAuditResponse(BaseModelConfig):
    id: UUID
    name: str
    last_name: str
    position: str


class TaskHistoryResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    action: HistoryAction
    old_status: Optional[TaskStatus] = None
    new_status: Optional[TaskStatus] = None
    change_reason: Optional[str] = None
    created_at: datetime

    # Datos del autor del cambio gracias a la relación changed_by
    changed_by: UserAuditResponse
