from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.project.infrastructure.models import Project


class ReportType(str, enum.Enum):
    EXECUTIVE_SUMMARY = "executive_summary"  # Resumen ejecutivo general
    STATUS_REPORT = "status_report"  # Estado actual del proyecto
    CLIENT_SUMMARY = "client_summary"  # Versión simplificada para cliente
    RISK_REPORT = "risk_report"  # Enfocado en riesgos


class ReportTrigger(str, enum.Enum):
    MANUAL = "manual"  # El usuario lo pidió explícitamente
    SCHEDULED = "scheduled"  # Lo generó el job automático


class ReportFrequency(str, enum.Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class WeekDay(str, enum.Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"


# ── Report ─────────────────────────────────────────────────────────────────────


class Report(Base, UUIDMixin, TimestampMixin):
    """Reporte generado por IA (OpenAI) para un proyecto.

    El contenido es texto markdown generado por el modelo.
    El snapshot_json guarda los datos del proyecto en el momento
    de generación para auditoría.
    """

    __tablename__ = "reports"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[ReportType] = mapped_column(
        Enum(ReportType, name="report_type"),
        nullable=False,
    )
    trigger: Mapped[ReportTrigger] = mapped_column(
        Enum(ReportTrigger, name="report_trigger"),
        nullable=False,
        default=ReportTrigger.MANUAL,
    )
    # El usuario que lo solicitó (null si fue automático)
    generated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Contenido del reporte en markdown
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Datos del proyecto en el momento de generación (JSON)
    snapshot_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Prompt usado (para debugging y mejora continua)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tokens consumidos en OpenAI
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Modelo de OpenAI que lo generó
    model_used: Mapped[str] = mapped_column(
        String(50), nullable=False, default="gpt-4o-mini"
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="reports"
    )
    generated_by: Mapped[User | None] = relationship(  # type: ignore[name-defined]
        "User", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Report project={self.project_id} type={self.report_type} trigger={self.trigger}>"


# ── ReportSchedule ─────────────────────────────────────────────────────────────


class ReportSchedule(Base, UUIDMixin, TimestampMixin):
    """Configuración de generación automática de reportes por proyecto.

    El job de APScheduler consulta esta tabla cada mañana para saber
    qué proyectos necesitan un reporte generado hoy.

    Lógica del job:
    - frequency=weekly + day_of_week=monday → genera cada lunes
    - frequency=biweekly → genera cada dos semanas (usando last_generated_at)
    - frequency=monthly → genera el día 1 de cada mes
    """

    __tablename__ = "report_schedules"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # 1 configuración por proyecto
        index=True,
    )
    frequency: Mapped[ReportFrequency] = mapped_column(
        Enum(ReportFrequency, name="report_frequency"),
        nullable=False,
        default=ReportFrequency.WEEKLY,
    )
    day_of_week: Mapped[WeekDay] = mapped_column(
        Enum(WeekDay, name="report_day_of_week"),
        nullable=False,
        default=WeekDay.MONDAY,
    )
    report_type: Mapped[ReportType] = mapped_column(
        Enum(ReportType, name="scheduled_report_type"),
        nullable=False,
        default=ReportType.STATUS_REPORT,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Fecha del último reporte generado (ISO datetime string)
    last_generated_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # También enviar por email al coordinador y cliente
    send_by_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="report_schedule"
    )

    def __repr__(self) -> str:
        return f"<ReportSchedule project={self.project_id} freq={self.frequency} active={self.is_active}>"
