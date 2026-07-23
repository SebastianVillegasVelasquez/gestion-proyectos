from __future__ import annotations

import datetime
import uuid
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.notifications.infrastructure.enums import NotificationType
from app.shared.base_database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    message: Mapped[str] = mapped_column(String(500), nullable=False)

    # Destinatario: a quién le aparecerá el aviso en su campanita.
    user_to_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Quién provocó la notificación (María asignó a Juan → actor es María).
    # Nullable: algunas notificaciones las origina el sistema, no un usuario.
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"),
        nullable=False,
    )

    # Datos contextuales (work_item_id, task_id, etc.) para que el frontend pueda
    # construir el link "ver tarea" sin pegar otro query. Estructura libre por diseño.
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # `read_at IS NULL` ⇔ no leída. Una sola fuente de verdad.
    read_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relaciones (SQLAlchemy resuelve por nombre de clase, no por __tablename__).
    recipient: Mapped["User"] = relationship(
        "User", foreign_keys=[user_to_id], back_populates="notifications"
    )
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_id])

    @property
    def is_read(self) -> bool:
        return self.read_at is not None
