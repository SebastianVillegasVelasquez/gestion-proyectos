from datetime import date, datetime, timedelta
from typing import Annotated, Optional
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

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
    # Equipo al que se delega la tarea (opcional). None = tarea normal del proyecto.
    team_id: Optional[UUID] = None
    status: Optional[TaskStatus] = None


class CreateTaskRequest(TaskBase):
    # Las tareas cuelgan del árbol flexible: de un WorkItem (cualquier nivel).
    work_item_id: UUID
    parent_task_id: Optional[UUID] = None
    depends_on_id: Optional[UUID] = None

    start_date: date
    # Se puede dar la fecha de fin o la duración en días (se calcula el fin).
    due_date: Optional[date] = None
    duration_days: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def resolve_dates(self) -> "CreateTaskRequest":
        if self.due_date is None and self.duration_days is not None:
            self.due_date = self.start_date + timedelta(days=self.duration_days)
        if self.due_date is None:
            raise ValueError("Indica una fecha de fin o una duración en días")
        if self.due_date < self.start_date:
            raise ValueError("La fecha límite no puede ser menor a la fecha de inicio")
        return self


class TaskResponse(TaskBase):
    id: UUID
    work_item_id: UUID
    parent_task_id: Optional[UUID] = None
    start_date: date
    due_date: date
    status: TaskStatus
    completed_at: Optional[datetime] = None
    created_at: datetime = datetime.today()
    updated_at: Optional[datetime] = None


class CreateTaskDependencyRequest(BaseModelConfig):
    depends_on_id: UUID


class TaskDependencyResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    depends_on_id: UUID


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
    team_id: Optional[UUID] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None


class TeamTaskItemResponse(BaseModelConfig):
    """Tarea delegada a un equipo, con su módulo y responsable para el workspace.

    Read model del espacio de trabajo: trae ya resuelto el nombre del módulo
    (WorkItem) y del responsable, para agrupar por módulo sin pedir el árbol.
    """

    id: UUID
    title: str
    status: TaskStatus
    priority: TaskPriority
    work_item_id: UUID
    work_item_name: str
    project_id: UUID
    project_name: str
    assignee_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    parent_task_id: Optional[UUID] = None
    start_date: date
    due_date: date


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
