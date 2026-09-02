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
    # Esfuerzo estimado en días. Opcional: una tarea puede nacer sin estimar
    # y estimarse cuando se sepa de qué va.
    estimated_days: Optional[Annotated[Decimal, Field(ge=0, le=9999)]] = None
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIA
    assignee_id: Optional[UUID] = None
    # Equipo al que se delega la tarea (opcional). None = tarea normal del proyecto.
    team_id: Optional[UUID] = None
    status: Optional[TaskStatus] = None
    # False (por defecto): el responsable entrega y queda COMPLETADA directo.
    # True: exige aprobación del líder/supervisor (flujo con EN_REVISION).
    requires_approval: bool = False


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
    # True: esta tarea ES el elemento (`work_item_id`) del que cuelga. Lo usa el
    # atajo "convertir el elemento en tarea"; el resto de altas lo dejan en False.
    represents_work_item: bool = False
    depends_on_id: Optional[UUID] = None
    # Predecesor que es un elemento del árbol (p. ej. una actividad de terceros).
    depends_on_work_item_id: Optional[UUID] = None

    # Las fechas son opcionales: una tarea puede crearse "por acomodar" y fijar
    # inicio, fin y responsable más tarde. Se puede dar la fecha de fin o la
    # duración en días (de la que se calcula el fin).
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    duration_days: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def resolve_dates(self) -> "CreateTaskRequest":
        # Con inicio + duración se calcula el fin. SIN inicio, la duración se
        # conserva (la usa el caso de uso para anclar al inicio del proyecto);
        # no es un error.
        if (
            self.due_date is None
            and self.duration_days is not None
            and self.start_date is not None
        ):
            self.due_date = self.start_date + timedelta(days=self.duration_days)
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("La fecha límite no puede ser menor a la fecha de inicio")
        return self

    @model_validator(mode="after")
    def require_project_or_work_item(self) -> "CreateTaskRequest":
        if self.project_id is None and self.work_item_id is None:
            raise ValueError("Indica el proyecto o el elemento de la estructura")
        return self

    # `assignee_id` + `team_id` juntos SÍ es válido: es "asignar directamente a un
    # integrante del equipo" (la tarea es del equipo pero ya tiene responsable,
    # sin que el líder tenga que repartirla). Solo `team_id` = va a la bolsa del
    # equipo; solo `assignee_id` = tarea individual; ninguno = sin asignar.


class CreateTeamTaskRequest(BaseModelConfig):
    """Alta de una tarea DESDE el espacio de un equipo (la crea su líder o
    supervisor). El equipo y el proyecto salen del contexto (la ruta), no del
    cuerpo: aquí solo se decide el título, de qué elemento cuelga, de qué tarea
    es subtarea y —si ya se sabe— quién la hace.

    A diferencia de `CreateTaskRequest`, `assignee_id` y el equipo NO se
    excluyen: en el equipo, "asignar a un integrante" es justo el estado
    válido «tarea del equipo con responsable». El caso de uso crea primero la
    tarea del equipo y, si viene responsable, la asigna por el mismo camino
    sancionado que usa el líder para reasignar.
    """

    title: Annotated[str, StringConstraints(min_length=2, max_length=200)]
    priority: TaskPriority = TaskPriority.MEDIA
    description: Optional[str] = None
    assignee_id: Optional[UUID] = None
    work_item_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    depends_on_id: Optional[UUID] = None
    depends_on_work_item_id: Optional[UUID] = None
    # Igual que en `CreateTaskRequest`: desactivado por defecto, se puede
    # marcar para exigir aprobación del líder/supervisor.
    requires_approval: bool = False

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    duration_days: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def resolve_dates(self) -> "CreateTeamTaskRequest":
        if (
            self.due_date is None
            and self.duration_days is not None
            and self.start_date is not None
        ):
            self.due_date = self.start_date + timedelta(days=self.duration_days)
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("La fecha límite no puede ser menor a la fecha de inicio")
        return self


class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    work_item_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    # Posición entre las tareas hermanas (prioridad / orden de cumplimiento).
    orden: int = 0
    # True cuando esta tarea ES el elemento de la estructura del que cuelga.
    represents_work_item: bool = False
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: TaskStatus
    completed_at: Optional[datetime] = None
    created_at: datetime = datetime.today()
    updated_at: Optional[datetime] = None
    # Nombre del responsable, resuelto en lectura cuando la consulta lo trae
    # (listados de proyecto / elemento). La estructura lo usa para el chip del
    # responsable aunque la persona no figure entre los integrantes DIRECTOS
    # del proyecto (p. ej. es integrante de un equipo). `None` = sin responsable
    # o no resuelto en esta ruta.
    assignee_name: Optional[str] = None
    # Días realmente dedicados (suma de los apuntes). Se calcula en lectura;
    # 0 cuando nadie ha registrado nada todavía.
    logged_days: Decimal = Decimal("0")
    # Avance 0-100. Sin subtareas: por estado. Con subtareas: promedio del
    # avance de las subtareas, sin llegar a 100 hasta que el entregable padre
    # se aprueba. Se calcula en lectura (rollup de las hojas hacia arriba).
    progress_pct: int = 0
    # True solo si la tarea depende (FtS) de una «actividad de terceros». La
    # estructura muestra la etiqueta "Depende de terceros".
    depends_on_third_party: bool = False


class CreateTimeEntryRequest(BaseModelConfig):
    """Apunte de días dedicados a una tarea en una jornada (p. ej. 0.5)."""

    days: Annotated[Decimal, Field(gt=0, le=1)]
    work_date: date
    notes: Optional[Annotated[str, StringConstraints(max_length=500)]] = None


class TimeEntryResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    user_id: UUID
    # Nombre de quien dedicó el esfuerzo, resuelto en lectura para no pedir el
    # directorio entero solo para pintar una lista de apuntes.
    user_name: Optional[str] = None
    days: Decimal
    work_date: date
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class TaskEffortResponse(BaseModelConfig):
    """Estimado vs. dedicado de una tarea, con el detalle de los apuntes."""

    task_id: UUID
    estimated_days: Optional[Decimal] = None
    logged_days: Decimal = Decimal("0")
    entries: list[TimeEntryResponse] = []


class AttachTaskRequest(BaseModelConfig):
    work_item_id: UUID


class ReorderTaskRequest(BaseModelConfig):
    """Recoloca una tarea entre sus hermanas (mismo elemento y misma tarea
    padre). `after_id` = la hermana tras la cual queda; `null` (o ausente) = al
    principio. Solo cambia la prioridad / orden de cumplimiento; no toca fechas.
    """

    after_id: Optional[UUID] = None


class CreateTaskDependencyRequest(BaseModelConfig):
    # Predecesor: otra tarea O un elemento del árbol. Exactamente uno.
    depends_on_id: Optional[UUID] = None
    depends_on_work_item_id: Optional[UUID] = None

    @model_validator(mode="after")
    def one_target(self) -> "CreateTaskDependencyRequest":
        if (self.depends_on_id is None) == (self.depends_on_work_item_id is None):
            raise ValueError(
                "Indica una tarea O un elemento del que depender, no ambos ni ninguno"
            )
        return self


class TaskDependencyResponse(BaseModelConfig):
    id: UUID
    task_id: UUID
    depends_on_id: Optional[UUID] = None
    depends_on_work_item_id: Optional[UUID] = None


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
    estimated_days: Optional[Annotated[Decimal, Field(ge=0, le=9999)]] = None
    requires_approval: Optional[bool] = None

    # Fijar `assignee_id` y `team_id` a la vez es válido: "asignar directamente a
    # un integrante" (tarea del equipo con responsable, sin repartir del líder).


class BlockingTaskResponse(BaseModelConfig):
    """Tarea bloqueante (dependencia FtS) resumida para pintar el indicador.

    id + título + estado + responsable: el workspace muestra "Bloqueada por:
    <título>" y atenúa el aviso cuando la bloqueante ya está completada; «Mis
    tareas» además dice quién la tiene. `assignee_name` es None para las
    dependencias hacia un elemento del árbol (no tienen responsable).
    """

    id: UUID
    title: str
    status: TaskStatus
    assignee_name: Optional[str] = None


class WorkItemCrumbResponse(BaseModelConfig):
    """Un eslabón de la cadena RAÍZ→elemento de una tarea, con su tipo, para
    pintar la miga de pan con los mismos colores que la Estructura."""

    id: UUID
    name: str
    tipo_id: Optional[UUID] = None
    tipo_nombre: Optional[str] = None
    es_dependencia_externa: bool = False


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
    requires_approval: bool = False
    # Avance 0-100. Con subtareas: promedio del avance de sus subtareas (una
    # tarea padre es un entregable y no llega a 100 hasta aprobarse). Sin
    # subtareas: por estado.
    progress_pct: int = 0
    # Dependencias finish-to-start ya resueltas a título: la vista de equipo
    # necesita mostrar el bloqueo sin pedir /tasks/{id}/dependencies por fila.
    blocked_by: list[BlockingTaskResponse] = []
    # True solo si la tarea depende (FtS) de una «actividad de terceros».
    depends_on_third_party: bool = False


class MyTaskItemResponse(BaseModelConfig):
    """Una tarea asignada al usuario autenticado, en cualquier proyecto ("Mis
    tareas"). Trae proyecto, elemento y equipo ya resueltos; la UI calcula el
    aviso de vencimiento a partir de `due_date` + `status`.

    `team_id` presente = la tarea es de un equipo (se entrega por el espacio de
    ese equipo); ausente = tarea individual (se entrega por «Mis entregas»).
    """

    id: UUID
    title: str
    status: TaskStatus
    priority: TaskPriority
    project_id: UUID
    project_name: str
    work_item_id: Optional[UUID] = None
    work_item_name: Optional[str] = None
    # Cadena RAÍZ→elemento (él incluido) para la miga de pan con colores de tipo.
    work_item_ancestors: list[WorkItemCrumbResponse] = []
    team_id: Optional[UUID] = None
    team_name: Optional[str] = None
    parent_task_id: Optional[UUID] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    requires_approval: bool = False
    # Avance 0-100 (mismo cálculo que en el resto de vistas).
    progress_pct: int = 0
    # Días estimados de trabajo (los que fijan el fin al resolverse una
    # dependencia). La UI los pinta como pill de duración.
    estimated_days: Optional[Decimal] = None
    # Motivo por el que NO se puede entregar todavía (dependencia FtS incompleta
    # o actividad de terceros ancestro sin entregar), o None si se puede. Mismo
    # texto que el 422 del servidor: la UI desactiva el botón "Entregar" con él.
    delivery_blocked_reason: Optional[str] = None
    # True solo si la tarea depende (FtS) de una «actividad de terceros»: la UI
    # muestra la etiqueta "Depende de terceros".
    depends_on_third_party: bool = False
    # Dependencias FtS ya resueltas a título (misma forma que la vista de equipo).
    blocked_by: list[BlockingTaskResponse] = []


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
