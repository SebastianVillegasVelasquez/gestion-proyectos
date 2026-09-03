from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.teams.infrastructure.models import Team


class ProjectFolder(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Carpeta del archivador de un proyecto.

    El archivador es un árbol con una forma deliberadamente rígida en su primer
    nivel:

        raíz del proyecto            (parent_id = NULL, sin dueño)
        ├── carpeta de un equipo     (parent_id = raíz, team_id = <equipo>)
        │   └── lo que el equipo organice…
        └── carpeta de una persona   (parent_id = raíz, user_id = <persona>)
            └── sus entregas individuales

    En la raíz solo cuelgan carpetas CON DUEÑO —un equipo o una persona—, y hay
    una por dueño: si cualquiera pudiera crear carpetas sueltas ahí, en dos
    semanas la raíz sería un cajón de sastre y nadie sabría de quién es qué.
    Dentro de su carpeta el dueño manda y anida lo que quiera.

    La carpeta de persona existe porque una tarea individual no tiene equipo y
    su entrega necesita igualmente un sitio con nombre dentro del proyecto.
    """

    __tablename__ = "project_folders"
    __table_args__ = (
        # Un equipo, una carpeta. Índice parcial: solo cuenta lo vivo, así que
        # borrar la carpeta de un equipo permite volver a crearla.
        Index(
            "uq_project_folders_team_alive",
            "project_id",
            "team_id",
            unique=True,
            postgresql_where=("team_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        # Una persona, una carpeta. Mismo criterio que el de equipo.
        Index(
            "uq_project_folders_user_alive",
            "project_id",
            "user_id",
            unique=True,
            postgresql_where=("user_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index("ix_project_folders_project_parent", "project_id", "parent_id"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # NULL = la raíz del proyecto (una por proyecto, la crea el sistema).
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_folders.id", ondelete="CASCADE"),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Dueño de la carpeta de primer nivel: un equipo O una persona, nunca los
    # dos. Se hereda hacia abajo por navegación (el permiso se resuelve subiendo
    # hasta el primer ancestro con dueño), no se copia: copiarlo obligaría a
    # reescribir el subárbol al mover una carpeta.
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=True,
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    parent: Mapped[Optional["ProjectFolder"]] = relationship(
        "ProjectFolder", remote_side="ProjectFolder.id"
    )
    team: Mapped[Optional["Team"]] = relationship("Team")
    # `foreign_keys` explícito: la tabla tiene DOS caminos hacia `users`
    # (el dueño y quien la creó) y SQLAlchemy no puede adivinar cuál es cuál.
    owner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    author: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])


class ProjectFile(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Un archivo dentro de una carpeta del proyecto.

    En la base solo vive el metadato; el contenido está en `FileStorage` bajo
    `storage_key`. Separarlos es lo que permite cambiar de disco local a S3 sin
    tocar ni la tabla ni las consultas.
    """

    __tablename__ = "project_files"
    __table_args__ = (
        UniqueConstraint("folder_id", "name", name="uq_project_files_folder_name"),
    )

    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_folders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    content_type: Mapped[str] = mapped_column(String(150), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    folder: Mapped["ProjectFolder"] = relationship("ProjectFolder")
    author: Mapped[Optional["User"]] = relationship("User")
