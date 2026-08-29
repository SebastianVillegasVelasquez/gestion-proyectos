from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.reminders.infrastructure.enums import (
    ReminderChannel,
    ReminderStatus,
)
from app.shared.base_database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


def _enum(py_enum, name: str):
    """Enum nativo que persiste el VALUE (minúscula), como los del workspace."""
    return Enum(py_enum, name=name, values_callable=lambda e: [m.value for m in e])


class PersonalReminder(Base, UUIDMixin, TimestampMixin):
    """Un recordatorio que una persona se pone a sí misma.

    Nada que ver con las tareas del proyecto: es la "nota para el yo futuro"
    —"llamar al cliente el martes", "revisar el guion antes del viernes"—.
    Cuando llega ``remind_at`` un worker lo despacha por el canal elegido
    (notificación in-app y/o correo) y lo marca ``ENVIADO``.
    """

    __tablename__ = "personal_reminders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    remind_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    channel: Mapped[ReminderChannel] = mapped_column(
        _enum(ReminderChannel, "reminder_channel"),
        nullable=False,
        default=ReminderChannel.NOTIFICACION,
    )
    status: Mapped[ReminderStatus] = mapped_column(
        _enum(ReminderStatus, "reminder_status"),
        nullable=False,
        default=ReminderStatus.PENDIENTE,
        index=True,
    )
    sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User")
