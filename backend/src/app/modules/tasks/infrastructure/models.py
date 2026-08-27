from __future__ import annotations

import datetime
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, UUID, Enum, UniqueConstraint
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
    from app.modules.project.infrastructure.models import Project


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

    # Toda tarea pertenece a un proyecto desde su creación, exista o no todavía
    # una estructura para colgarla. Es la referencia estable para listarlas.
    # Esfuerzo ESTIMADO en horas (lo que se cree que costará). Lo realmente
    # dedicado vive en `time_entries`: comparar ambos es lo que permite
    # planificar mejor la próxima vez y sostener un modelo de pago por horas.
    estimated_hours: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Las tareas pueden colgar del árbol flexible: de un WorkItem (cualquier
    # nivel: módulo, fase, componente, actividad…). Nullable: una tarea puede
    # crearse suelta (independiente) y adjuntarse a un elemento más tarde,
    # cuando la estructura del proyecto ya exista.
    work_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_items.id"), nullable=True, index=True
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

    # Fechas opcionales: una tarea puede nacer como borrador (solo título) y
    # planificarse — inicio, fin y responsable — más tarde.
    start_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project: Mapped["Project"] = relationship("Project", lazy="raise")
    work_item: Mapped[Optional["WorkItem"]] = relationship("WorkItem", lazy="raise")
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
    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    time_entries: Mapped[list["TaskTimeEntry"]] = relationship(
        "TaskTimeEntry",
        back_populates="task",
        cascade="all, delete-orphan",
    )

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

    # Delta genérico para los cambios que no son de estado (equipo, ubicación,
    # fechas, prioridad). Se guarda ya RESUELTO a texto legible —"Contenidos",
    # "Unidad 3", "2026-09-01 → 2026-09-15"— y no como ids: el historial es un
    # hecho del pasado y debe seguir leyéndose aunque el equipo se renombre o
    # el elemento se borre. Nadie filtra por estos valores; solo se leen.
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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


class TaskTimeEntry(Base, UUIDMixin, TimestampMixin):
    """Horas dedicadas a una tarea por una persona en un día.

    Se registra por DÍA y no como un cronómetro: aquí nadie va a arrancar y
    parar un contador mientras graba un video; lo que se hace es apuntar al
    final de la jornada. Cada apunte es una fila (no un acumulador) para poder
    corregir uno sin recalcular nada, y para saber quién dedicó qué.
    """

    __tablename__ = "task_time_entries"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    # Día al que se imputan las horas (no cuándo se apuntaron).
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="time_entries")


class TaskComment(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Comentario en una tarea, con las personas mencionadas en él.

    La conversación vive junto al trabajo y no en un chat aparte: quien llega
    tarde a una tarea necesita leer por qué se decidió lo que se decidió.

    Las menciones se guardan como filas propias (`TaskCommentMention`) y no
    parseando el texto al vuelo: quién fue avisado es un hecho del pasado, y
    editar el cuerpo del comentario no puede cambiarlo ni volver a notificar.
    """

    __tablename__ = "task_comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="comments")
    mentions: Mapped[list["TaskCommentMention"]] = relationship(
        "TaskCommentMention",
        back_populates="comment",
        cascade="all, delete-orphan",
    )


class TaskCommentMention(Base, UUIDMixin, TimestampMixin):
    """Persona mencionada en un comentario (y por tanto notificada)."""

    __tablename__ = "task_comment_mentions"

    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("task_comments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    comment: Mapped["TaskComment"] = relationship(
        "TaskComment", back_populates="mentions"
    )

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_mention"),
    )
