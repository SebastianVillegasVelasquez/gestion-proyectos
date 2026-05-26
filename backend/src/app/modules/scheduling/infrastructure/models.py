from __future__ import annotations
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.project.infrastructure.models import Project
    from app.modules.tasks.infrastructure.models import Task
    from app.modules.identity.infrastructure.models import User


# ── Schedule ───────────────────────────────────────────────────────────────────


class Schedule(Base, UUIDMixin, TimestampMixin):
    """Cronograma de un proyecto.

    Mantiene dos líneas de tiempo:
    - baseline: la planificación original (inmutable una vez aprobada)
    - current: la planificación actual (puede modificarse)

    El delta entre ambas indica cuánto se ha desviado el proyecto.
    """

    __tablename__ = "schedules"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # 1 cronograma por proyecto
        index=True,
    )

    # Baseline (planificación original)
    baseline_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    baseline_end: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Current (planificación vigente)
    current_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    current_end: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Métricas de desvío
    total_delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_baseline_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="schedule"
    )
    entries: Mapped[list[GanttEntry]] = relationship(
        "GanttEntry",
        back_populates="schedule",
        cascade="all, delete-orphan",
        lazy="select",
    )
    reprogrammings: Mapped[list[Reprogramming]] = relationship(
        "Reprogramming",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="Reprogramming.created_at",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Schedule project={self.project_id} delay={self.total_delay_days}d>"


# ── GanttEntry ─────────────────────────────────────────────────────────────────


class GanttEntry(Base, UUIDMixin, TimestampMixin):
    """Entrada de Gantt para una tarea específica.

    Almacena las fechas planificadas (baseline y current) y las reales,
    para calcular desvíos a nivel de tarea individual.
    """

    __tablename__ = "gantt_entries"

    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # 1 entrada por tarea
        index=True,
    )

    # Fechas planificadas baseline
    baseline_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    baseline_end: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Fechas planificadas actuales (pueden modificarse)
    planned_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    planned_end: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Fechas reales (se llenan conforme avanza el trabajo)
    actual_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    actual_end: Mapped[str | None] = mapped_column(String(10), nullable=True)

    is_milestone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_critical_path: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Desvío calculado para esta entrada en particular
    delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    schedule: Mapped[Schedule] = relationship("Schedule", back_populates="entries")
    task: Mapped[Task] = relationship(  # type: ignore[name-defined]
        "Task", back_populates="gantt_entry"
    )

    def __repr__(self) -> str:
        return f"<GanttEntry task={self.task_id} [{self.planned_start} → {self.planned_end}]>"


# ── Reprogramming ──────────────────────────────────────────────────────────────


class Reprogramming(Base, UUIDMixin, TimestampMixin):
    """Log de cada ajuste de cronograma.

    Permite auditar quién movió qué fechas y por qué razón.
    Esencial para rendir cuentas ante el cliente.
    """

    __tablename__ = "reprogrammings"

    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # Snapshot JSON de las fechas antes del cambio
    previous_dates_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Snapshot JSON de las fechas después del cambio
    new_dates_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    schedule: Mapped[Schedule] = relationship(
        "Schedule", back_populates="reprogrammings"
    )
    requested_by: Mapped[User] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Reprogramming schedule={self.schedule_id} by={self.requested_by_id}>"
