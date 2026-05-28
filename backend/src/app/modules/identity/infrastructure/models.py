from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin

from .enums import UserRole

if TYPE_CHECKING:
    from app.modules.notifications.infrastructure.models import Notification
    from app.modules.project.infrastructure.models import Project, ProjectMember
    from app.modules.tasks.infrastructure.models import Task


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Aggregate root del bounded context Identity.

    Un User tiene un rol global en el sistema (super_admin, admin, etc.)
    y además puede tener un rol específico dentro de cada proyecto
    a través de ProjectMember.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(254), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.MEMBER,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    coordinated_projects: Mapped[list[Project]] = relationship(
        "Project",
        back_populates="coordinator",
        lazy="select",
    )

    project_memberships: Mapped[list[ProjectMember]] = relationship(
        "ProjectMember",
        back_populates="user",
        lazy="select",
    )

    assigned_tasks: Mapped[list[Task]] = relationship(
        "Task",
        back_populates="assignee",
        lazy="select",
    )

    notifications: Mapped[list[Notification]] = relationship(
        "Notification",
        back_populates="recipient",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
