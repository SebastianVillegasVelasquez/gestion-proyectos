from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UUID, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.teams.infrastructure.enums import InvitationStatus, TeamRole
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User


class Team(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Equipo de trabajo: vive dentro de un proyecto y no existe fuera de él."""

    __tablename__ = "teams"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_team_name_per_project"),
    )


class TeamMember(Base, UUIDMixin, TimestampMixin):
    """Pertenencia de un usuario a un equipo, con su rol interno.

    Referencia al usuario por id (otro bounded context). Al entrar, el rol por
    defecto es INTEGRANTE; el admin puede cambiarlo.
    """

    __tablename__ = "team_members"

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    team_role: Mapped[TeamRole] = mapped_column(
        # values_callable: persistimos el VALUE del enum ('integrante') en vez del
        # NAME por defecto de SQLAlchemy ('INTEGRANTE'), para que coincida con el
        # tipo `team_role` creado en la migración con valores en minúscula.
        Enum(
            TeamRole, name="team_role", values_callable=lambda e: [m.value for m in e]
        ),
        nullable=False,
        default=TeamRole.INTEGRANTE,
    )

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    user: Mapped["User"] = relationship("User")

    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)


class TeamInvitation(Base, UUIDMixin, TimestampMixin):
    """Invitación de un líder a un integrante del proyecto para unirse a su equipo.

    La persona NO se convierte en `TeamMember` hasta que acepta. Una fila por
    (equipo, usuario): reinvitar tras un rechazo reutiliza la misma fila.
    """

    __tablename__ = "team_invitations"

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    invited_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(
            InvitationStatus,
            name="invitation_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=InvitationStatus.PENDIENTE,
    )
    responded_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    team: Mapped["Team"] = relationship("Team")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    invited_by: Mapped["User"] = relationship("User", foreign_keys=[invited_by_id])

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_invitation"),
    )
