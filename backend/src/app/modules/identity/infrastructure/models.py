from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin
from .enums import SystemRole, UserPosition

if TYPE_CHECKING:
    from app.modules.project.infrastructure.models import ProjectMember
    from app.modules.tasks.infrastructure.models import Task, TaskHistory


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(254), unique=True, nullable=False, index=True
    )
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    role: Mapped[SystemRole] = mapped_column(
        Enum(SystemRole, name="user_role"),
        nullable=False,
        default=SystemRole.USER,
    )

    position: Mapped[UserPosition] = mapped_column(
        Enum(UserPosition, name="user_position"), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relaciones

    tasks: Mapped[list[Task]] = relationship("Task", back_populates="assignee")

    task_history: Mapped[list[TaskHistory]] = relationship(
        "TaskHistory", back_populates="changed_by"
    )

    project_members: Mapped[list[ProjectMember]] = relationship(
        "ProjectMember", back_populates="user"
    )

    def __repr__(self) -> str:
        return (
            f"<User id={self.id} email={self.email} role={self.role}>"
            f"name={self.name} last_name={self.last_name}"
            f"position={self.position}"
        )
