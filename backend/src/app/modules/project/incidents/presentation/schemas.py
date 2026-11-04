from datetime import date, datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import Field, StringConstraints, computed_field, model_validator

from app.modules.project.incidents.domain.enums import IncidentResponsible
from app.shared.base_model import BaseModelConfig

Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
LongText = Annotated[str, StringConstraints(max_length=20000)]
ImpactDays = Annotated[int, Field(ge=0, le=3650)]


class CreateIncidentRequest(BaseModelConfig):
    title: Title
    description: Optional[LongText] = None
    email_body: Optional[LongText] = None
    responsible: IncidentResponsible = IncidentResponsible.CLIENTE
    incident_date: date
    impact_days: ImpactDays = 0
    client_response_date: Optional[date] = None

    @model_validator(mode="after")
    def response_not_before_incident(self) -> "CreateIncidentRequest":
        if self.client_response_date and self.client_response_date < self.incident_date:
            raise ValueError(
                "La respuesta del cliente no puede ser anterior al incidente"
            )
        return self


class UpdateIncidentRequest(BaseModelConfig):
    """Parche parcial. Solo `description`, `email_body` y `client_response_date`
    admiten `null` (para vaciarlos); en el resto un `null` se ignora."""

    title: Optional[Title] = None
    description: Optional[LongText] = None
    email_body: Optional[LongText] = None
    responsible: Optional[IncidentResponsible] = None
    incident_date: Optional[date] = None
    impact_days: Optional[ImpactDays] = None
    client_response_date: Optional[date] = None


class IncidentAttachmentResponse(BaseModelConfig):
    id: UUID
    name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class IncidentResponse(BaseModelConfig):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    email_body: Optional[str] = None
    responsible: IncidentResponsible
    incident_date: date
    impact_days: int
    client_response_date: Optional[date] = None
    applied_days: Optional[int] = None
    applied_at: Optional[datetime] = None
    author_name: Optional[str] = None
    created_at: datetime
    attachments: list[IncidentAttachmentResponse] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_applied(self) -> bool:
        return self.applied_days is not None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def client_response_days(self) -> Optional[int]:
        """Días que tardó el cliente en responder (si ya respondió)."""
        if self.client_response_date is None:
            return None
        return (self.client_response_date - self.incident_date).days
