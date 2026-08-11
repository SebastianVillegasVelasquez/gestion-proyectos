from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.teams.infrastructure.models import Team, TeamMember


class TeamRepository(ABC):
    """Contrato del repositorio de equipos (Dependency Inversion).

    Las use cases dependen de esta abstracción, no de SQLAlchemy. Así se puede
    inyectar un fake en los tests y cambiar la persistencia sin tocar el dominio.
    """

    # ── Equipos ──────────────────────────────────────────────────────────────
    @abstractmethod
    async def add_team(self, team: Team) -> Team: ...

    @abstractmethod
    async def save_team(self, team: Team) -> Team: ...

    @abstractmethod
    async def get_team(self, project_id: UUID, team_id: UUID) -> Team | None: ...

    @abstractmethod
    async def get_team_by_name(self, project_id: UUID, name: str) -> Team | None: ...

    @abstractmethod
    async def search_teams(
        self, project_id: UUID, search: str | None, limit: int, offset: int
    ) -> tuple[list[Team], int]: ...

    @abstractmethod
    async def count_members(self, team_id: UUID) -> int: ...

    @abstractmethod
    async def member_counts(self, team_ids: list[UUID]) -> dict[UUID, int]: ...

    @abstractmethod
    async def progress_counts(
        self, team_ids: list[UUID]
    ) -> dict[UUID, tuple[int, int]]: ...

    # ── Integrantes ──────────────────────────────────────────────────────────
    @abstractmethod
    async def add_member(self, member: TeamMember) -> TeamMember: ...

    @abstractmethod
    async def save_member(self, member: TeamMember) -> TeamMember: ...

    @abstractmethod
    async def get_member(self, team_id: UUID, user_id: UUID) -> TeamMember | None: ...

    @abstractmethod
    async def list_members(self, team_id: UUID) -> list[TeamMember]: ...

    @abstractmethod
    async def delete_member(self, member: TeamMember) -> None: ...
