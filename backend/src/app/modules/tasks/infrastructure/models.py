from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, UUID, Enum
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
    from app.modules.project.infrastructure.models import ProjectNode


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

    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_nodes.id"), nullable=False
    )
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    node: Mapped["ProjectNode"] = relationship("ProjectNode")
    assignee: Mapped["User"] = relationship("User")
    history: Mapped[list["TaskHistory"]] = relationship(
        "TaskHistory", back_populates="task", cascade="all, delete-orphan"
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
