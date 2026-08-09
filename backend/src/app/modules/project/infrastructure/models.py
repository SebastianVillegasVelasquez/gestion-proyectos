from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Enum, Float, ForeignKey, String, Text, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Date

from app.modules.project.infrastructure.enums import ProjectRole
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

    # Token secreto e impredecible para el portal público del cliente. El cliente
    # accede a /portal/{token} sin iniciar sesión y ve, en solo lectura, el avance
    # de ESTE proyecto. Regenerarlo invalida el enlace anterior (revocación).
    client_access_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )

    members: Mapped[list[ProjectMember]] = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    # La estructura interna (programa/curso/módulo/fase, o componente/actividad…)
    # vive en `project.structure` como WorkItem recursivo. No hay tipo fijo aquí:
    # cada proyecto define sus TipoNodo.


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


class ProjectNote(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Nota/recordatorio sobre un proyecto: un problema, una anomalía o algo que
    conviene dejar por escrito. Lleva su propia fecha (por defecto hoy, pero
    editable) y su autor. Borrado lógico para poder quitarla sin perder historial.
    """

    __tablename__ = "project_notes"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Autor de la nota. ON DELETE SET NULL: si se borra el usuario, la nota
    # permanece (solo queda sin autor).
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Fecha a la que refiere la nota (por defecto la de hoy en la app, editable).
    note_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
