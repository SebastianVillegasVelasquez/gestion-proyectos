from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, UUID, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import String, Text, Date, DateTime

from app.modules.tasks.infrastructure.enums import (
    TaskStatus,
    TaskPriority,
    HistoryAction,
)
from app.shared.base_database import Base
from app.shared.base_entity import UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.project.structure.infrastructure.models import WorkItem


class Task(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"),
        nullable=False,
        default=TaskStatus.PENDIENTE_POR_INICIAR,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority"),
        default=TaskPriority.NO_DEFINIDA,
        nullable=False,
    )

    # Las tareas cuelgan del árbol flexible: de un WorkItem (cualquier nivel:
    # módulo, fase, componente, actividad…). El nivel lo decide el usuario al
    # configurar la estructura del proyecto.
    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_items.id"), nullable=False, index=True
    )
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Equipo al que se delega la tarea (Fase 1 del espacio de trabajo). Nullable:
    # una tarea normal del proyecto no pertenece a ningún equipo. ON DELETE SET
    # NULL: borrar el equipo no borra la tarea, solo la desvincula.
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Tarea padre: el admin crea la tarea global y el coordinador crea subtareas
    # apuntando a ella. Auto-relación nullable.
    parent_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )

    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    work_item: Mapped["WorkItem"] = relationship("WorkItem", lazy="raise")
    assignee: Mapped["User"] = relationship("User")
    history: Mapped[list["TaskHistory"]] = relationship(
        "TaskHistory", back_populates="task", cascade="all, delete-orphan"
    )

    subtasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    parent: Mapped[Optional["Task"]] = relationship(
        "Task",
        remote_side="Task.id",
        back_populates="subtasks",
    )

    # Dependencias finish-to-start: esta tarea no puede iniciar hasta que las
    # tareas de las que depende estén completadas.
    dependencies: Mapped[list["TaskDependency"]] = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        back_populates="task",
        cascade="all, delete-orphan",
    )


class TaskHistory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "task_history"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )

    changed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    action: Mapped[HistoryAction] = mapped_column(
        Enum(HistoryAction, name="history_action"), nullable=False
    )

    # Deltas de estado (Para medir tiempos entre fases)
    old_status: Mapped[Optional[TaskStatus]] = mapped_column(
        Enum(TaskStatus, name="task_status"), nullable=True
    )
    new_status: Mapped[Optional[TaskStatus]] = mapped_column(
        Enum(TaskStatus, name="task_status"), nullable=True
    )

    # El campo más importante para devoluciones: ¿Por qué se rechazó o reasignó?
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Navegación
    task: Mapped["Task"] = relationship("Task", back_populates="history")
    changed_by: Mapped["User"] = relationship("User", back_populates="task_history")


class TaskDependency(Base, UUIDMixin, TimestampMixin):
    """Dependencia finish-to-start entre dos tareas.

    `task` no puede iniciar hasta que `depends_on` esté completada.
    """

    __tablename__ = "task_dependencies"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )

    task: Mapped["Task"] = relationship(
        "Task", foreign_keys=[task_id], back_populates="dependencies"
    )
    depends_on: Mapped["Task"] = relationship("Task", foreign_keys=[depends_on_id])

    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
    )
