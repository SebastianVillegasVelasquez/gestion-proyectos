from datetime import date, datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.modules.identity.presentation.schemas import UserResponse
from app.modules.project.infrastructure.enums import ProjectRole
from app.shared.base_model import BaseModelConfig


class CreateProjectRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=200)]
    description: Annotated[
        Optional[str], StringConstraints(min_length=2, max_length=300)
    ]
    client_name: Annotated[
        Optional[str], StringConstraints(min_length=2, max_length=100)
    ]

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "CreateProjectRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError(
                "La fecha de finalización no puede ser menor a la fecha de inicio"
            )
        return self


class ProjectResponse(BaseModelConfig):
    id: UUID
    name: str
    description: Optional[str] = ""
    client_name: Optional[str] = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress_pct: Optional[float] = None
    # Alcance del cronograma del portal del cliente (ver `ClientAccessResponse`).
    client_schedule_element_depth: int = 0
    client_schedule_include_tasks: bool = False
    client_schedule_include_subtasks: bool = False


class UpdateProjectRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=200)] | None = None
    description: (
        Annotated[str, StringConstraints(min_length=2, max_length=300)] | None
    ) = None
    client_name: (
        Annotated[str, StringConstraints(min_length=2, max_length=100)] | None
    ) = None

    start_date: date | None = None
    end_date: date | None = None

    # Alcance del cronograma del portal del cliente. Se envían los tres juntos
    # desde el modal "Configurar cronograma"; `exclude_unset` deja intactos los
    # que no viajen (p. ej. un PATCH que solo cambia el nombre).
    client_schedule_element_depth: int | None = Field(default=None, ge=0, le=20)
    client_schedule_include_tasks: bool | None = None
    client_schedule_include_subtasks: bool | None = None

    @model_validator(mode="after")
    def validate_schedule_scope(self) -> "UpdateProjectRequest":
        # Sin tareas no hay subtareas que mostrar: normalizamos aquí para que el
        # backend del portal no tenga que cruzar ambos flags.
        if self.client_schedule_include_tasks is False:
            self.client_schedule_include_subtasks = False
        return self


class ProjectMemberRequest(BaseModelConfig):
    user_id: UUID
    project_id: UUID
    project_role: ProjectRole


class ProjectMemberResponse(BaseModelConfig):
    id: UUID
    user_id: UUID
    name: str
    last_name: str
    email: str
    position: str
    project_role: ProjectRole


class UpdateProjectMemberRoleRequest(BaseModelConfig):
    project_role: ProjectRole


class ProjectMemberProgressResponse(BaseModelConfig):
    """Integrante + su avance ponderado en ESTE proyecto (nunca cruzado con otros).

    `progress_pct` no es completadas/totales plano: pesa cada tarea según la
    profundidad de su nodo en la estructura (ver `member_progress` en domain).
    Es el número que determina cuándo corresponde pagarle su parte.
    """

    id: UUID
    user_id: UUID
    name: str
    last_name: str
    email: str
    position: str
    project_role: ProjectRole
    tasks_total: int
    tasks_completed: int
    progress_pct: int
    # Equipos de trabajo de ESTE proyecto a los que pertenece el integrante.
    # Vacío si aún no está en ninguno. Un integrante puede estar en varios.
    # `team_ids` va en el mismo orden que `team_names` (para enlazar cada chip).
    team_names: list[str] = []
    team_ids: list[UUID] = []


class ResponseProjectMember(BaseModelConfig):
    users: list[UserResponse] = []


class ClientAccessResponse(BaseModelConfig):
    """Token del portal del cliente + alcance del cronograma que verá.

    El frontend arma el enlace /portal/{token} y precarga con estos valores el
    modal "Configurar cronograma". `schedule_element_depth` = 0 significa "todos
    los niveles de la estructura"; N ≥ 1, solo hasta esa profundidad. Las tareas
    y subtareas solo se muestran si su flag está activo (subtareas ⇒ tareas).
    """

    token: str
    schedule_element_depth: int = 0
    schedule_include_tasks: bool = False
    schedule_include_subtasks: bool = False


class CreateProjectNoteRequest(BaseModelConfig):
    content: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    # Opcional: si no se envía, la nota toma la fecha de hoy.
    note_date: Optional[date] = None


class ProjectNoteResponse(BaseModelConfig):
    id: UUID
    project_id: UUID
    content: str
    note_date: date
    author_id: Optional[UUID] = None
    author_name: Optional[str] = None
    created_at: datetime


# El informe del proyecto vive ahora en `analytics.py` / `analytics_schemas.py`
# (analítica en el tiempo + export HTML). El CSV y el read model plano de aquí
# se retiraron con la fase 6.1.
