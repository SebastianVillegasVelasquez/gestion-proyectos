from __future__ import annotations
import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin


if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.project.infrastructure.models import Project


class NotificationType(str, enum.Enum):
    TASK_OVERDUE = "task_overdue"
    TASK_DUE_SOON = "task_due_soon"
    TASK_ASSIGNED = "task_assigned"
    TASK_STATUS_CHANGED = "task_status_changed"
    PROJECT_STATUS_CHANGED = "project_status_changed"
    REPORT_GENERATED = "report_generated"
    SCHEDULE_REPROGRAMMED = "schedule_reprogrammed"
    WEEKLY_SUMMARY = "weekly_summary"
    CUSTOM = "custom"


class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    IN_APP = "in_app"  # para fase futura con websockets


class AlertFrequency(str, enum.Enum):
    IMMEDIATE = "immediate"  # se envía en el momento del evento
    DAILY = "daily"
    WEEKLY = "weekly"


# ── Notification ───────────────────────────────────────────────────────────────


class Notification(Base, UUIDMixin, TimestampMixin):
    """Notificación individual dirigida a un usuario.

    Se crea cuando ocurre un evento (tarea vencida, cambio de estado, etc.)
    o cuando un job programado la genera.
    """

    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Referencia opcional a la entidad que la originó
    related_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel"),
        nullable=False,
        default=NotificationChannel.EMAIL,
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_at: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # ISO datetime
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    recipient: Mapped[User] = relationship(  # type: ignore[name-defined]
        "User", back_populates="notifications"
    )
    project: Mapped[Project | None] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="notifications"
    )
    delivery_logs: Mapped[list[DeliveryLog]] = relationship(
        "DeliveryLog",
        back_populates="notification",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Notification type={self.notification_type} recipient={self.recipient_id} sent={self.is_sent}>"


# ── AlertRule ──────────────────────────────────────────────────────────────────


class AlertRule(Base, UUIDMixin, TimestampMixin):
    """Configuración de alertas por proyecto.

    El coordinador puede personalizar qué alertas activar y con qué
    frecuencia para cada proyecto.
    """

    __tablename__ = "alert_rules"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="alert_notification_type"),
        nullable=False,
    )
    frequency: Mapped[AlertFrequency] = mapped_column(
        Enum(AlertFrequency, name="alert_frequency"),
        nullable=False,
        default=AlertFrequency.IMMEDIATE,
    )
    # Días de anticipación para alertas de vencimiento próximo
    days_before_due: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<AlertRule project={self.project_id} type={self.notification_type} freq={self.frequency}>"


# ── DeliveryLog ────────────────────────────────────────────────────────────────


class DeliveryLog(Base, UUIDMixin, TimestampMixin):
    """Registro de cada intento de entrega de una notificación.

    Permite hacer retry inteligente y detectar problemas de envío.
    """

    __tablename__ = "delivery_logs"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_message_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    notification: Mapped["Notification"] = relationship(
        "Notification", back_populates="delivery_logs"
    )

    def __repr__(self) -> str:
        return (
            f"<DeliveryLog notification={self.notification_id} success={self.success}>"
        )
