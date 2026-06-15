from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.presentation.schemas import UserResponse
from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.shared.base_model import BaseModelConfig


def _validate_phase_dates(start: date | None, end: date | None) -> None:
    if start and end and end < start:
        raise ValueError(
            "La fecha de finalización no puede ser menor a la fecha de inicio"
        )


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
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError(
                    "La fecha de finalización no puede ser menor a la fecha de inicio"
                )
        return self

    @model_validator(mode="after")
    def validate_dates_optional(self) -> "CreateProjectRequest":
        if self.start_date is not None:
            if self.start_date < date.today():
                raise ValueError(
                    "La fecha de inicio no puede ser menor a la fecha actual"
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


class CreateProjectNodeRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=100)]
    node_type: NodeType
    project_id: UUID
    parent_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    type_label: Annotated[
        Optional[str], StringConstraints(min_length=1, max_length=50)
    ] = None
    end_date: Optional[date] = None


class ProjectNodeResponse(BaseModelConfig):
    id: UUID
    name: Annotated[str, StringConstraints(min_length=2, max_length=100)]
    node_type: NodeType
    project_id: UUID
    parent_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    type_label: Optional[str] = None
    end_date: Optional[date] = None


class UpdateProjectNodeRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=100)] | None = None
    type_label: Annotated[
        Optional[str], StringConstraints(min_length=1, max_length=50)
    ] = None
    phase_id: Optional[UUID] = None
    end_date: Optional[date] = None


class CreatePhaseRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)]
    # order_index es opcional: si no se envía, el servicio asigna el siguiente.
    order_index: Optional[int] = Field(default=None, ge=0)
    duration_days: Optional[int] = Field(default=None, gt=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "CreatePhaseRequest":
        _validate_phase_dates(self.start_date, self.end_date)
        return self


class UpdatePhaseRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)] | None = None
    order_index: Optional[int] = Field(default=None, ge=0)
    duration_days: Optional[int] = Field(default=None, gt=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "UpdatePhaseRequest":
        _validate_phase_dates(self.start_date, self.end_date)
        return self


class PhaseResponse(BaseModelConfig):
    id: UUID
    name: str
    order_index: int
    duration_days: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    project_id: UUID


class ProjectMemberRequest(BaseModelConfig):
    user_id: UUID
    project_id: UUID
    project_role: ProjectRole


class ProjectMemberResponse(BaseModelConfig):
    user_id: UUID
    name: str
    last_name: str
    position: UserPosition
    project_role: ProjectRole


class ResponseProjectMember(BaseModelConfig):
    users: list[UserResponse] = []
