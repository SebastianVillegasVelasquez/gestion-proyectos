from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints, model_validator

from app.modules.identity.presentation.schemas import UserResponse
from app.modules.project.infrastructure.enums import NodeType
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


class CreateProjectNodeResponse(BaseModelConfig):
    name: list[Annotated[str, StringConstraints(min_length=2, max_length=100)]]


class ResponseProjectMember(BaseModelConfig):
    users: list[UserResponse] = []
