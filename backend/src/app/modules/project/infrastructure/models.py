from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Enum, UUID
from sqlalchemy import (
    Float,
    Integer,
    String,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Date

from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


class Project(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    start_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    # Progreso a calcular usando la cantidad de tareas máximas por tareas completadas
    progress_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Relación uno-a-muchos con los nodos raíz (los programas)
    nodes: Mapped[list[ProjectNode]] = relationship(
        "ProjectNode",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    members: Mapped[list[ProjectMember]] = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    # Fases ordenadas del proyecto. Delimitan qué tareas pueden empezar antes
    # que otras (la fase N+1 no arranca hasta cerrar la fase N).
    phases: Mapped[list["Phase"]] = relationship(
        "Phase",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Phase.order_index",
    )


class Phase(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "phases"

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Posición de la fase dentro del proyecto (0-based). Define el orden de bloqueo.
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Parametrización opcional por duración (en días) en lugar de fechas fijas.
    duration_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Fechas opcionales y editables.
    start_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
    )

    project: Mapped[Project] = relationship("Project", back_populates="phases")


class ProjectNode(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "project_nodes"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    node_type: Mapped[NodeType] = mapped_column(Enum(NodeType), nullable=False)

    # Etiqueta flexible que el admin puede definir para el nivel del nodo.
    # Permite mostrar "Corte" o "Unidad" en lugar del nombre del enum (MODULO).
    type_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
    )

    # Fase a la que pertenece la jerarquía. La fijan los nodos raíz; los hijos
    # la heredan a través del parent. Opcional para compatibilidad hacia atrás.
    phase_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("phases.id"),
        nullable=True,
    )

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_nodes.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Fecha de entrega opcional y editable para este nodo (módulo/curso/etc).
    end_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    # Relaciones

    children: Mapped[list[ProjectNode]] = relationship(
        "ProjectNode",
        back_populates="parent",
        cascade="all, delete-orphan",
    )

    parent: Mapped[Optional[ProjectNode]] = relationship(
        "ProjectNode",
        remote_side="ProjectNode.id",
        back_populates="children",
    )

    project: Mapped[Project] = relationship("Project", back_populates="nodes")


class ProjectMember(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Este rol es diferente al rol del sistema.
    # Sirve para dividir la autorizacion dentro del proyecto mas no dentro del sistema.
    project_role: Mapped[ProjectRole] = mapped_column(
        Enum(ProjectRole), nullable=False, default=ProjectRole.INTEGRANTE
    )

    # Opción A (snapshot): de qué equipo se copió este integrante (si aplica).
    # Permite re-sincronizar o auditar el origen sin acoplar contextos en vivo.
    source_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True,
    )

    # Relacion
    user: Mapped[User] = relationship("User", back_populates="project_members")
    project: Mapped[Project] = relationship("Project", back_populates="members")
