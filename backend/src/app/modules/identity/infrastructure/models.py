from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin
from .enums import SystemRole

if TYPE_CHECKING:
    from app.modules.notifications.infrastructure.models import Notification
    from app.modules.project.infrastructure.models import ProjectMember
    from app.modules.tasks.infrastructure.models import Task, TaskHistory


class Position(Base, UUIDMixin, TimestampMixin):
    """Cargo/posición de la empresa: catálogo mutable y persistente.

    Reemplaza al antiguo enum nativo de Postgres (``user_position``): admin,
    super_admin y developer pueden agregar cargos nuevos en caliente (p. ej. un
    perfil que la empresa nunca había contratado) sin necesitar una migración.
    ``key`` es el identificador estable (usado por ``users.position`` y por el
    contrato value/label de ``GET /identity/positions``); ``label`` es el
    texto legible que ve el usuario.
    """

    __tablename__ = "positions"

    key: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(254), unique=True, nullable=False, index=True
    )
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Documento de identidad (opcional). El número es único cuando está presente
    # —así una misma persona no se registra dos veces— pero puede quedar vacío:
    # Postgres admite múltiples NULL en un índice único.
    document_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    document_number: Mapped[str | None] = mapped_column(
        String(32), nullable=True, unique=True, index=True
    )

    role: Mapped[SystemRole] = mapped_column(
        Enum(SystemRole, name="user_role"),
        nullable=False,
        default=SystemRole.USER,
    )

    position: Mapped[str] = mapped_column(
        String(64), ForeignKey("positions.key"), nullable=False
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

    notifications: Mapped[list["Notification"]] = relationship(
        "Notification",
        foreign_keys="Notification.user_to_id",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<User id={self.id} email={self.email} role={self.role}>"
            f"name={self.name} last_name={self.last_name}"
            f"position={self.position}"
        )
