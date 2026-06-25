from __future__ import annotations

import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.feedback.infrastructure.enums import FeedbackStatus, FeedbackType
from app.shared.base_database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


class Feedback(Base, UUIDMixin, TimestampMixin):
    """Feedback del sitio enviado por un usuario (bueno, malo, idea, etc.)."""

    __tablename__ = "feedback"

    message: Mapped[str] = mapped_column(Text, nullable=False)

    feedback_type: Mapped[FeedbackType] = mapped_column(
        Enum(FeedbackType, name="feedback_type"),
        nullable=False,
    )

    # Estado de gestión (lo cambia el developer desde su bandeja).
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, name="feedback_status"),
        nullable=False,
        default=FeedbackStatus.PENDIENTE,
    )

    # Ruta del frontend desde donde se envió (contexto para triage en producción).
    page: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    # Autor. Nullable + SET NULL: el feedback sobrevive aunque se borre el usuario.
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    author: Mapped[Optional["User"]] = relationship("User")
