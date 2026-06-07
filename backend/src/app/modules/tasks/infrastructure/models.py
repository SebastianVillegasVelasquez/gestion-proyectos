from __future__ import annotations

import datetime
import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import String, Text, Date

from app.shared.base_database import Base
from app.shared.base_entity import UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.modules.identity.infrastructure.models import User
    from app.modules.project.infrastructure.models import ProjectNode


class Task(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Pendiente")

    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_nodes.id"),
        nullable=False,
    )

    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    # Relaciones
    node: Mapped[ProjectNode] = relationship("ProjectNode")
    assignee: Mapped[User] = relationship("User")
