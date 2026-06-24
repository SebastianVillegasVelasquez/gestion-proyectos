from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints

from app.modules.feedback.infrastructure.enums import FeedbackType
from app.shared.base_model import BaseModelConfig


class CreateFeedbackRequest(BaseModelConfig):
    feedback_type: FeedbackType
    message: Annotated[str, StringConstraints(min_length=3, max_length=2000)]
    # Ruta del frontend desde donde se envía (opcional, ayuda al triage).
    page: Optional[str] = None


class FeedbackResponse(BaseModelConfig):
    id: UUID
    feedback_type: FeedbackType
    message: str
    page: Optional[str] = None
    user_id: Optional[UUID] = None
    # Nombre del autor para la vista de administración (None si se borró el usuario).
    author_name: Optional[str] = None
    created_at: datetime


class PaginatedFeedbackResponse(BaseModelConfig):
    items: list[FeedbackResponse]
    total: int
    page: int
    page_size: int
