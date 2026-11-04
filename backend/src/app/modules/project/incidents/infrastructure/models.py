from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UUID,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Date

from app.modules.identity.infrastructure.models import User
from app.modules.project.incidents.domain.enums import IncidentResponsible
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin


class ProjectIncident(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Incidente contractual de un proyecto: algo que lo frenó o lo afectó.

    Es una bitácora: registra qué pasó, de quién fue la responsabilidad, cuántos
    días impactó y, opcionalmente, cuándo respondió el cliente. NO toca el
    cronograma por sí solo; `applied_days` guarda cuántos días se reflejaron en
    la fecha de fin del proyecto (NULL = aún no reflejado) para poder revertirlo
    con exactitud aunque `impact_days` se edite después.
    """

    __tablename__ = "project_incidents"
    __table_args__ = (
        CheckConstraint("impact_days >= 0", name="ck_project_incidents_impact_days"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cuerpo del correo (u otro texto) que respalda el incidente.
    email_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsible: Mapped[IncidentResponsible] = mapped_column(
        Enum(IncidentResponsible, name="incident_responsible"),
        nullable=False,
        default=IncidentResponsible.CLIENTE,
    )

    # El dato más importante: cuándo ocurrió.
    incident_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    impact_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    # Opcional, se completa después: cuándo respondió el cliente.
    client_response_date: Mapped[Optional[datetime.date]] = mapped_column(
        Date, nullable=True
    )

    applied_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    applied_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    author: Mapped[Optional[User]] = relationship("User", foreign_keys=[created_by])
    # Solo las evidencias vivas: el filtro de borrado lógico vive en la relación
    # para que ninguna consulta tenga que acordarse de aplicarlo.
    attachments: Mapped[list[IncidentAttachment]] = relationship(
        "IncidentAttachment",
        primaryjoin=(
            "and_(ProjectIncident.id == IncidentAttachment.incident_id, "
            "IncidentAttachment.deleted_at.is_(None))"
        ),
        order_by="IncidentAttachment.created_at",
        viewonly=True,
    )


class IncidentAttachment(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Evidencia de un incidente (imagen, correo exportado, PDF…).

    Igual que `ProjectFile`: en la base solo el metadato; el byte vive en
    `FileStorage` bajo `storage_key`.
    """

    __tablename__ = "incident_attachments"

    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_incidents.id", ondelete="CASCADE"),
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
