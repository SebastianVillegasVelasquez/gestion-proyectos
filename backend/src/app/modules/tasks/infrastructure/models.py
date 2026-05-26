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
    from app.modules.project.infrastructure.models import Project, Module
    from app.modules.identity.infrastructure.models import User
    from app.modules.scheduling.infrastructure.models import GanttEntry


class TaskType(str, enum.Enum):
    TASK = "task"
    SUBTASK = "subtask"
    ACTIVITY = "activity"
    MILESTONE = "milestone"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, enum.Enum):
    """Estados base de tareas (independientes de los estados del proyecto)."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELLED = "cancelled"


class DependencyType(str, enum.Enum):
    """Tipos de dependencia Gantt estándar."""

    FINISH_TO_START = "FS"  # La más común: B empieza cuando A termina
    START_TO_START = "SS"  # B empieza cuando A empieza
    FINISH_TO_FINISH = "FF"  # B termina cuando A termina
    START_TO_FINISH = "SF"  # Raro


# ── Task ───────────────────────────────────────────────────────────────────────


class Task(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Aggregate root del bounded context Tasks.

    Soporta jerarquía mediante auto-referencia: una Task puede tener
    un parent_task_id, convirtiendo esa tarea en subtarea o actividad.

    Árbol máximo sugerido: Task → Subtask → Activity (3 niveles).
    """

    __tablename__ = "tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Auto-referencia para jerarquía (subtareas)
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    task_type: Mapped[TaskType] = mapped_column(
        Enum(TaskType, name="task_type"),
        nullable=False,
        default=TaskType.TASK,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority"),
        nullable=False,
        default=TaskPriority.MEDIUM,
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"),
        nullable=False,
        default=TaskStatus.PENDING,
        index=True,
    )

    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Fechas como string ISO para simplicidad (sin timezone issues)
    start_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Progreso y retraso
    progress_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # True si se calculó automáticamente que está vencida
    is_overdue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Fase 2: trazabilidad de duplicación
    duplicated_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped[Project] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="tasks", lazy="select"
    )
    module: Mapped[Module | None] = relationship(  # type: ignore[name-defined]
        "Module", back_populates="tasks", lazy="select"
    )
    assignee: Mapped[User | None] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[assignee_id],
        back_populates="assigned_tasks",
        lazy="select",
    )

    # Jerarquía
    parent: Mapped[Task | None] = relationship(
        "Task",
        foreign_keys=[parent_task_id],
        back_populates="children",
        remote_side="Task.id",
        lazy="select",
    )
    children: Mapped[list[Task]] = relationship(
        "Task",
        foreign_keys=[parent_task_id],
        back_populates="parent",
        order_by="Task.order",
        lazy="select",
    )

    # Dependencias: esta tarea depende de otras
    dependencies: Mapped[list[TaskDependency]] = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="select",
    )
    # Otras tareas que dependen de esta
    dependents: Mapped[list[TaskDependency]] = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.depends_on_id",
        back_populates="depends_on",
        lazy="select",
    )

    comments: Mapped[list[TaskComment]] = relationship(
        "TaskComment",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskComment.created_at",
        lazy="select",
    )
    status_history: Mapped[list[TaskStatusHistory]] = relationship(
        "TaskStatusHistory",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskStatusHistory.created_at",
        lazy="select",
    )
    gantt_entry: Mapped[GanttEntry | None] = relationship(  # type: ignore[name-defined]
        "GanttEntry",
        back_populates="task",
        uselist=False,
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title!r} status={self.status}>"


# ── TaskDependency ─────────────────────────────────────────────────────────────


class TaskDependency(Base, UUIDMixin, TimestampMixin):
    """Relación de dependencia entre dos tareas.

    REGLA DE NEGOCIO: el grafo de dependencias no puede tener ciclos.
    Esto se valida en el domain service usando DFS antes de persistir.
    """

    __tablename__ = "task_dependencies"

    # La tarea que tiene la dependencia
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # La tarea de la que depende
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependency_type: Mapped[DependencyType] = mapped_column(
        Enum(DependencyType, name="dependency_type"),
        nullable=False,
        default=DependencyType.FINISH_TO_START,
    )
    lag_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    task: Mapped[Task] = relationship(
        "Task", foreign_keys=[task_id], back_populates="dependencies"
    )
    depends_on: Mapped[Task] = relationship(
        "Task", foreign_keys=[depends_on_id], back_populates="dependents"
    )

    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
    )

    def __repr__(self) -> str:
        return f"<TaskDependency {self.task_id} -{self.dependency_type}-> {self.depends_on_id}>"


# ── TaskComment ────────────────────────────────────────────────────────────────


class TaskComment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    task: Mapped[Task] = relationship("Task", back_populates="comments")
    author: Mapped[User] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<TaskComment task={self.task_id} author={self.author_id}>"


# ── TaskStatusHistory ──────────────────────────────────────────────────────────


class TaskStatusHistory(Base, UUIDMixin, TimestampMixin):
    """Trazabilidad de cada cambio de estado en una tarea.

    Permite ver el historial completo de movimientos y calcular
    tiempos por estado para analítica.
    """

    __tablename__ = "task_status_history"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    changed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    from_status: Mapped[TaskStatus | None] = mapped_column(
        Enum(TaskStatus, name="task_status_from"),
        nullable=True,
    )
    to_status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status_to"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    task: Mapped[Task] = relationship("Task", back_populates="status_history")
    changed_by: Mapped[User] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<TaskStatusHistory task={self.task_id} {self.from_status} → {self.to_status}>"
