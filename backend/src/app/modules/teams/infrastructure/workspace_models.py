from __future__ import annotations

import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UUID, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
    ResourceType,
)
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


def _enum(py_enum, name: str):
    """Enum nativo que persiste el VALUE (minúscula), igual que team_role."""
    return Enum(py_enum, name=name, values_callable=lambda e: [m.value for m in e])


class Deliverable(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Entregable de una tarea dentro del espacio de trabajo de un equipo.

    Pertenece a un equipo (team_id) — la información vive y se queda en ese equipo.
    """

    __tablename__ = "team_deliverables"

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    task_title: Mapped[str] = mapped_column(String(300), nullable=False)
    assignee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # Vínculo opcional con la Task real del proyecto (Fase 2): al entregar,
    # aprobar o rechazar aquí, movemos Task.status y escribimos TaskHistory.
    # Nullable para retrocompatibilidad con entregables sueltos existentes.
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[DeliverableStatus] = mapped_column(
        _enum(DeliverableStatus, "deliverable_status"),
        nullable=False,
        default=DeliverableStatus.BORRADOR,
    )

    versions: Mapped[list["DeliverableVersion"]] = relationship(
        "DeliverableVersion",
        back_populates="deliverable",
        cascade="all, delete-orphan",
        order_by="DeliverableVersion.version_number",
    )
    comments: Mapped[list["DeliverableComment"]] = relationship(
        "DeliverableComment",
        back_populates="deliverable",
        cascade="all, delete-orphan",
        order_by="DeliverableComment.created_at",
    )


class DeliverableVersion(Base, UUIDMixin, TimestampMixin):
    """Una entrega concreta (línea de tiempo): su recurso (URL) + nota."""

    __tablename__ = "deliverable_versions"

    deliverable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_deliverables.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    resource_type: Mapped[ResourceType] = mapped_column(
        _enum(ResourceType, "resource_type"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    deliverable: Mapped["Deliverable"] = relationship(
        "Deliverable", back_populates="versions"
    )
    uploader: Mapped["User"] = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "deliverable_id", "version_number", name="uq_deliverable_version"
        ),
    )


class DeliverableComment(Base, UUIDMixin, TimestampMixin):
    """Aporte en el hilo de retroalimentación de un entregable."""

    __tablename__ = "deliverable_comments"

    deliverable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_deliverables.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    comment_type: Mapped[CommentType] = mapped_column(
        _enum(CommentType, "comment_type"),
        nullable=False,
        default=CommentType.COMENTARIO,
    )
    # Menciones a otros usuarios (lista de user_id como string). Detalle simple en JSONB.
    mentions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    deliverable: Mapped["Deliverable"] = relationship(
        "Deliverable", back_populates="comments"
    )
    author: Mapped["User"] = relationship("User")
