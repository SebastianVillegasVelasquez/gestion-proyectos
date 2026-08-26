from datetime import date, datetime, timedelta
from decimal import Decimal
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
    # Esfuerzo estimado en horas. Opcional: una tarea puede nacer sin estimar
    # y estimarse cuando se sepa de qué va.
    estimated_hours: Optional[Annotated[Decimal, Field(ge=0, le=9999)]] = None
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIA
    assignee_id: Optional[UUID] = None
    # Equipo al que se delega la tarea (opcional). None = tarea normal del proyecto.
    team_id: Optional[UUID] = None
    status: Optional[TaskStatus] = None


class BulkTasksFromBranchRequest(BaseModelConfig):
    """Crea de una vez una tarea por cada elemento de una rama.

    El caso real: una unidad con decenas de piezas (video, guion, quiz) donde
    cada pieza es una tarea de alguien. Darlas de alta una por una es el cuello
    de botella de montar un proyecto.
    """

    # Por defecto solo las HOJAS: los elementos con contenido suelen ser
    # agrupadores ("Unidad 3"), y lo que alguien produce son sus piezas.
    only_leaves: bool = True
    # Un elemento que ya tiene tarea no se duplica; volver a lanzar la carga
    # sobre la misma rama solo crea lo que falta.
    skip_with_tasks: bool = True
    # Hereda las fechas del elemento (las efectivas del cronograma). Si no,
    # la tarea nace sin fechas y se planifica luego.
    inherit_dates: bool = True

    priority: TaskPriority = TaskPriority.MEDIA
    assignee_id: Optional[UUID] = None
    team_id: Optional[UUID] = None

    @model_validator(mode="after")
    def person_xor_team(self) -> "BulkTasksFromBranchRequest":
        if self.assignee_id is not None and self.team_id is not None:
            raise ValueError(
                "Asigna las tareas a una persona o a un equipo, no a ambos"
            )
        return self


class SkippedElementResponse(BaseModelConfig):
    """Elemento de la rama para el que no se creó tarea, y por qué."""

    work_item_id: UUID
    nombre: str
    motivo: str


class BulkTasksResultResponse(BaseModelConfig):
    created: list["TaskResponse"] = []
    skipped: list[SkippedElementResponse] = []
    total_elementos: int = 0


class CreateCommentRequest(BaseModelConfig):
    """Comentario en una tarea, con las personas mencionadas.

    Las menciones llegan como una lista EXPLÍCITA de ids, no parseando "@algo"
    del texto: dos personas pueden llamarse igual y un nombre puede escribirse
    de varias formas. Quien escribe elige en un desplegable; el backend no
    adivina a quién se refería.
    """

    body: Annotated[str, StringConstraints(min_length=1, max_length=4000)]
    mentioned_user_ids: list[UUID] = []


class CommentResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    author_id: UUID
    author_name: Optional[str] = None
    body: str
    mentioned_user_ids: list[UUID] = []
    created_at: Optional[datetime] = None


class CreateTaskRequest(TaskBase):
    # Las tareas pueden colgar del árbol flexible (un WorkItem, cualquier
    # nivel) o crearse sueltas, sin estructura todavía. `project_id` es
    # obligatorio salvo que se indique `work_item_id`, del que se deriva.
    project_id: Optional[UUID] = None
    work_item_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    depends_on_id: Optional[UUID] = None

    # Las fechas son opcionales: una tarea puede crearse "por acomodar" y fijar
    # inicio, fin y responsable más tarde. Se puede dar la fecha de fin o la
    # duración en días (de la que se calcula el fin) cuando ya hay inicio.
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    duration_days: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def resolve_dates(self) -> "CreateTaskRequest":
        # Solo derivamos y validamos coherencia cuando los datos vienen; sin
        # fechas la tarea queda como borrador a la espera de planificación.
        if self.due_date is None and self.duration_days is not None:
            if self.start_date is None:
                raise ValueError("Indica la fecha de inicio para usar la duración")
            self.due_date = self.start_date + timedelta(days=self.duration_days)
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("La fecha límite no puede ser menor a la fecha de inicio")
        return self

    @model_validator(mode="after")
    def require_project_or_work_item(self) -> "CreateTaskRequest":
        if self.project_id is None and self.work_item_id is None:
            raise ValueError("Indica el proyecto o el elemento de la estructura")
        return self

    @model_validator(mode="after")
    def assignee_or_team_exclusive(self) -> "CreateTaskRequest":
        # Una tarea se delega a UNA persona O a UN equipo, nunca a ambos: si va a
        # un equipo, es el líder quien reparte subtareas entre sus integrantes.
        if self.assignee_id is not None and self.team_id is not None:
            raise ValueError("Asigna la tarea a una persona o a un equipo, no a ambos")
        return self


class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    work_item_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: TaskStatus
    completed_at: Optional[datetime] = None
    created_at: datetime = datetime.today()
    updated_at: Optional[datetime] = None
    # Horas realmente dedicadas (suma de los apuntes). Se calcula en lectura;
    # 0 cuando nadie ha registrado nada todavía.
    logged_hours: Decimal = Decimal("0")


class CreateTimeEntryRequest(BaseModelConfig):
    """Apunte de horas dedicadas a una tarea en un día."""

    hours: Annotated[Decimal, Field(gt=0, le=24)]
    work_date: date
    notes: Optional[Annotated[str, StringConstraints(max_length=500)]] = None


class TimeEntryResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    user_id: UUID
    # Nombre de quien dedicó las horas, resuelto en lectura para no pedir el
    # directorio entero solo para pintar una lista de apuntes.
    user_name: Optional[str] = None
    hours: Decimal
    work_date: date
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class TaskEffortResponse(BaseModelConfig):
    """Estimado vs. dedicado de una tarea, con el detalle de los apuntes."""

    task_id: UUID
    estimated_hours: Optional[Decimal] = None
    logged_hours: Decimal = Decimal("0")
    entries: list[TimeEntryResponse] = []


class AttachTaskRequest(BaseModelConfig):
    work_item_id: UUID


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
    estimated_hours: Optional[Annotated[Decimal, Field(ge=0, le=9999)]] = None

    @model_validator(mode="after")
    def assignee_or_team_exclusive(self) -> "UpdateTaskRequest":
        # Coherencia persona/equipo: no se pueden fijar ambos en el mismo cambio.
        if self.assignee_id is not None and self.team_id is not None:
            raise ValueError("Asigna la tarea a una persona o a un equipo, no a ambos")
        return self


class TeamTaskItemResponse(BaseModelConfig):
    """Tarea delegada a un equipo, con su módulo y responsable para el workspace.

    Read model del espacio de trabajo: trae ya resuelto el nombre del módulo
    (WorkItem) y del responsable, para agrupar por módulo sin pedir el árbol.
    """

    id: UUID
    title: str
    status: TaskStatus
    priority: TaskPriority
    work_item_id: Optional[UUID] = None
    work_item_name: Optional[str] = None
    project_id: UUID
    project_name: str
    assignee_id: Optional[UUID] = None
    assignee_name: Optional[str] = None
    parent_task_id: Optional[UUID] = None
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
