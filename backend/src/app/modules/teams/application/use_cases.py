from uuid import UUID

from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.domain.services import TeamService
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.presentation.schemas import (
    CreateTeamRequest,
    PaginatedTeamsResponse,
    TeamMemberResponse,
    TeamResponse,
    UpdateTeamRequest,
)
from app.shared.base_repository import Repository
from app.shared.exceptions import NotFoundError
from app.shared.pagination import Pagination


class CreateTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, data: CreateTeamRequest) -> TeamResponse:
        return await self.service.create_team(data)


class UpdateTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, team_id: UUID, data: UpdateTeamRequest) -> TeamResponse:
        return await self.service.update_team(team_id, data)


class DeleteTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, team_id: UUID) -> None:
        await self.service.delete_team(team_id)


class GetTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, team_id: UUID) -> TeamResponse:
        return await self.service.get_team(team_id)


class ListTeamsUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(
        self, search: str | None, pagination: Pagination
    ) -> PaginatedTeamsResponse:
        items, total = await self.service.search_teams(
            search, pagination.limit, pagination.offset
        )
        return PaginatedTeamsResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class AddTeamMemberUseCase:
    """Agrega un usuario al equipo. Valida que el usuario exista (otro contexto)."""

    def __init__(self, team_repo: TeamRepository, user_repo: Repository):
        self.service = TeamService(team_repo)
        self.user_repo = user_repo

    async def execute(
        self, team_id: UUID, user_id: UUID, team_role: TeamRole
    ) -> TeamMemberResponse:
        user = await self.user_repo.get_by_id(user_id)
        if user is None or getattr(user, "is_deleted", False):
            raise NotFoundError("El usuario no existe")
        return await self.service.add_member(team_id, user_id, team_role)


class ChangeTeamMemberRoleUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(
        self, team_id: UUID, user_id: UUID, team_role: TeamRole
    ) -> TeamMemberResponse:
        return await self.service.change_member_role(team_id, user_id, team_role)


class RemoveTeamMemberUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, team_id: UUID, user_id: UUID) -> None:
        await self.service.remove_member(team_id, user_id)


class ListTeamMembersUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, team_id: UUID) -> list[TeamMemberResponse]:
        return await self.service.list_members(team_id)
