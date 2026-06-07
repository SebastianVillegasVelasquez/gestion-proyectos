from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import Enum, UUID
from sqlalchemy import (
    Float,
    String,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Date

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import NodeType
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin


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


class ProjectNode(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "project_nodes"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    node_type: Mapped[NodeType] = mapped_column(Enum(NodeType), nullable=False)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
    )

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_nodes.id", ondelete="CASCADE"),
        nullable=True,
    )

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

    user: Mapped[User] = relationship("User", back_populates="project_members")
    project: Mapped[Project] = relationship("Project", back_populates="members")

    role: Mapped[str] = mapped_column(String(20), nullable=False)
