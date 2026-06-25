from dataclasses import dataclass
from uuid import UUID

from app.modules.project.infrastructure.enums import ProjectRole
from app.shared.events import DomainEvent


@dataclass(frozen=True)
class MemberAssigned(DomainEvent):
    """Un usuario fue agregado como miembro de un proyecto."""

    project_id: UUID
    user_id: UUID
    project_role: ProjectRole
    # Quien realizó la asignación. Nullable si la origina el sistema (seed, import, etc.).
    assigned_by: UUID | None
