from __future__ import annotations
import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.tasks.infrastructure.models import Task
    from app.modules.client_portal.infrastructure.models import ClientAccess
    from app.modules.ia_reporting.infrastructure.models import ReportSchedule, Report
    from app.modules.notifications.infrastructure.models import Notification
    from app.modules.scheduling.infrastructure.models import Schedule


class ProjectStatusType(str, enum.Enum):
    """
    Estados BASE fijos del sistema. Cada proyecto arranca con estos
    seeded y puede agregar estados custom adicionales a través de
    ProjectStatus con is_base=False.
    """

    PENDING = "pending"  # Por iniciar
    IN_PROGRESS = "in_progress"  # En progreso
    IN_REVIEW = "in_review"  # En revisión
    COMPLETED = "completed"  # Completado
    ON_HOLD = "on_hold"  # En pausa
    CANCELLED = "cancelled"  # Cancelado


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ProjectMemberRole(str, enum.Enum):
    """Rol dentro de un proyecto específico (diferente al rol global)."""

    COORDINATOR = "coordinator"
    MEMBER = "member"
    OBSERVER = "observer"


# ── Project ────────────────────────────────────────────────────────────────────


class Project(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Aggregate root del bounded context Projects.

    Un proyecto contiene módulos, tiene un equipo, define sus propios
    estados de flujo y tiene un coordinador responsable.
    """

    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Estado actual del proyecto: FK a project_statuses
    current_status_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_statuses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    coordinator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    start_date: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # ISO date
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO date

    # Progreso calculado (0.0 – 100.0). Se actualiza por domain service.
    progress_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Trazabilidad de duplicación (fase 2)
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    duplicated_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    coordinator: Mapped[User] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[coordinator_id],
        back_populates="coordinated_projects",
        lazy="select",
    )
    current_status: Mapped[ProjectStatus | None] = relationship(
        "ProjectStatus",
        foreign_keys=[current_status_id],
        lazy="select",
    )
    statuses: Mapped[list[ProjectStatus]] = relationship(
        "ProjectStatus",
        foreign_keys="ProjectStatus.project_id",
        back_populates="project",
        lazy="select",
        order_by="ProjectStatus.order",
        cascade="all, delete-orphan",
    )
    members: Mapped[list[ProjectMember]] = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="select",
    )
    modules: Mapped[list[Module]] = relationship(
        "Module",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Module.order",
        lazy="select",
    )
    tasks: Mapped[list[Task]] = relationship(  # type: ignore[name-defined]
        "Task",
        back_populates="project",
        lazy="select",
    )
    schedule: Mapped[Schedule | None] = relationship(  # type: ignore[name-defined]
        "Schedule",
        back_populates="project",
        uselist=False,
        lazy="select",
    )
    notifications: Mapped[list[Notification]] = relationship(  # type: ignore[name-defined]
        "Notification",
        back_populates="project",
        lazy="select",
    )
    reports: Mapped[list[Report]] = relationship(  # type: ignore[name-defined]
        "Report",
        back_populates="project",
        lazy="select",
    )
    report_schedule: Mapped[ReportSchedule | None] = relationship(  # type: ignore[name-defined]
        "ReportSchedule",
        back_populates="project",
        uselist=False,
        lazy="select",
    )
    client_accesses: Mapped[list[ClientAccess]] = relationship(  # type: ignore[name-defined]
        "ClientAccess",
        back_populates="project",
        lazy="select",
    )
    risks: Mapped[list[Risk]] = relationship(
        "Risk",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r}>"


# ── ProjectStatus ──────────────────────────────────────────────────────────────


class ProjectStatus(Base, UUIDMixin, TimestampMixin):
    """Estados de flujo por proyecto.

    Cada proyecto empieza con los estados base seeded (is_base=True).
    Los coordinadores pueden agregar estados personalizados (is_base=False).
    El orden define el flujo visual en el frontend.
    """

    __tablename__ = "project_statuses"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(
        String(7), nullable=False, default="#6366F1"
    )  # hex
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_base: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Mapeo al enum del sistema para lógica interna
    base_type: Mapped[ProjectStatusType | None] = mapped_column(
        Enum(ProjectStatusType, name="project_status_type"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship(
        "Project",
        foreign_keys=[project_id],
        back_populates="statuses",
        lazy="select",
    )

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_project_status_name"),
    )

    def __repr__(self) -> str:
        return f"<ProjectStatus project={self.project_id} name={self.name!r} order={self.order}>"


# ── ProjectMember ──────────────────────────────────────────────────────────────


class ProjectMember(Base, UUIDMixin, TimestampMixin):
    """Tabla pivote proyecto ↔ usuario con rol específico en el proyecto."""

    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[ProjectMemberRole] = mapped_column(
        Enum(ProjectMemberRole, name="project_member_role"),
        nullable=False,
        default=ProjectMemberRole.MEMBER,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship("Project", back_populates="members")
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", back_populates="project_memberships"
    )

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )

    def __repr__(self) -> str:
        return f"<ProjectMember project={self.project_id} user={self.user_id} role={self.role}>"


# ── Module ─────────────────────────────────────────────────────────────────────


class Module(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Agrupador lógico de tareas dentro de un proyecto.

    Ejemplo: en un proyecto de virtualización, los módulos podrían ser
    'Diseño instruccional', 'Producción audiovisual', 'QA', etc.
    """

    __tablename__ = "modules"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Fase 2: trazabilidad de duplicación
    duplicated_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship("Project", back_populates="modules")
    tasks: Mapped[list[Task]] = relationship(  # type: ignore[name-defined]
        "Task",
        back_populates="module",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Module id={self.id} name={self.name!r} project={self.project_id}>"


# ── Risk ───────────────────────────────────────────────────────────────────────


class Risk(Base, UUIDMixin, TimestampMixin):
    """Riesgo identificado en un proyecto."""

    __tablename__ = "risks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    level: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, name="risk_level"),
        nullable=False,
        default=RiskLevel.MEDIUM,
    )
    mitigation: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship("Project", back_populates="risks")

    def __repr__(self) -> str:
        return f"<Risk id={self.id} level={self.level} project={self.project_id}>"
