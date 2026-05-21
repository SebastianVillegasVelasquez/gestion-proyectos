import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.shared.base_entity import TimestampMixin, UUIDMixin


class ClientAccess(Base, UUIDMixin, TimestampMixin):
    """Token de acceso externo para que un cliente vea su proyecto.

    El token se genera por proyecto y se envía al cliente.
    Tiene fecha de expiración y puede rotarse (invalidar el anterior,
    generar uno nuevo).

    El cliente accede a: GET /client/{token}/project — que devuelve
    un read model con datos limitados (sin tareas internas, sin usuarios,
    solo progreso general, Gantt y reportes aprobados).
    """

    __tablename__ = "client_accesses"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # El usuario cliente en el sistema (opcional — puede ser anónimo)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Nombre descriptivo del acceso (ej: "Ministerio de Educación")
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    # Token único opaco (128 caracteres hex)
    token: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # ISO datetime — null = no expira
    expires_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Último acceso (para auditoría)
    last_accessed_at: Mapped[str | None] = mapped_column(String(30), nullable=True)
    access_count: Mapped[int] = mapped_column(default=0)

    # ── Relaciones ─────────────────────────────────────────────────────────────
    project: Mapped["Project"] = relationship(  # type: ignore[name-defined]
        "Project", back_populates="client_accesses"
    )
    user: Mapped["User | None"] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ClientAccess project={self.project_id} label={self.label!r} active={self.is_active}>"
