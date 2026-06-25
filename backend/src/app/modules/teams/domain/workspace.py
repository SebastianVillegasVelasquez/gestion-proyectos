from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin"}
_REVIEW_TEAM_ROLES = {TeamRole.LIDER, TeamRole.SUPERVISOR}


@dataclass(frozen=True)
class WorkspaceAccess:
    """Política de acceso al espacio de trabajo de un equipo (lógica pura).

    Única fuente de verdad de la autorización. Privacidad del equipo + visión del
    admin se expresan aquí; las rutas y use cases solo la consultan (SRP). Para
    extender reglas en el futuro se agregan propiedades, sin tocar el resto (OCP).
    """

    is_admin: bool
    team_role: TeamRole | None

    @classmethod
    def resolve(cls, system_role: str, team_role: TeamRole | None) -> "WorkspaceAccess":
        return cls(is_admin=system_role in _ADMIN_SYSTEM_ROLES, team_role=team_role)

    @property
    def is_member(self) -> bool:
        return self.team_role is not None

    @property
    def can_view(self) -> bool:
        """El admin observa cualquier equipo; el resto solo si es integrante."""
        return self.is_admin or self.is_member

    @property
    def can_deliver(self) -> bool:
        """Solo los integrantes del equipo entregan; el admin solo observa."""
        return self.is_member

    @property
    def can_comment(self) -> bool:
        return self.is_member

    @property
    def can_review(self) -> bool:
        """Solicitar cambios / aprobar: solo líder o supervisor del equipo."""
        return self.team_role in _REVIEW_TEAM_ROLES


class WorkspaceRepository(ABC):
    """Contrato de persistencia del espacio de trabajo (Dependency Inversion).

    Todo está acotado por `team_id`: la información de un equipo se queda en él.
    """

    @abstractmethod
    async def get_member_role(
        self, team_id: UUID, user_id: UUID
    ) -> TeamRole | None: ...

    @abstractmethod
    async def list_member_teams(self, user_id: UUID) -> list[Team]: ...

    @abstractmethod
    async def list_deliverables(self, team_id: UUID) -> list[Deliverable]: ...

    @abstractmethod
    async def get_deliverable(
        self, team_id: UUID, deliverable_id: UUID
    ) -> Deliverable | None: ...

    @abstractmethod
    async def add_deliverable(self, deliverable: Deliverable) -> Deliverable: ...

    @abstractmethod
    async def save_deliverable(self, deliverable: Deliverable) -> Deliverable: ...

    @abstractmethod
    async def add_version(self, version: DeliverableVersion) -> DeliverableVersion: ...

    @abstractmethod
    async def add_comment(self, comment: DeliverableComment) -> DeliverableComment: ...
