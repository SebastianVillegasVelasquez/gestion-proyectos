from uuid import UUID

from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.presentation.schemas import (
    CreateTeamRequest,
    TeamMemberResponse,
    TeamResponse,
    UpdateTeamRequest,
)
from app.shared.exceptions import ConflictError, NotFoundError


class TeamService:
    """Reglas del dominio de equipos. Depende de la abstracción TeamRepository."""

    def __init__(self, repo: TeamRepository):
        self.repo = repo

    # ── Equipos ──────────────────────────────────────────────────────────────
    async def create_team(
        self, project_id: UUID, data: CreateTeamRequest
    ) -> TeamResponse:
        if await self.repo.get_team_by_name(project_id, data.name) is not None:
            raise ConflictError("Ya existe un equipo con ese nombre en este proyecto")
        team = await self.repo.add_team(
            Team(project_id=project_id, name=data.name, description=data.description)
        )
        return self._to_team_response(team, member_count=0)

    async def update_team(
        self, project_id: UUID, team_id: UUID, data: UpdateTeamRequest
    ) -> TeamResponse:
        team = await self._get_active_team(project_id, team_id)
        if data.name and data.name != team.name:
            existing = await self.repo.get_team_by_name(project_id, data.name)
            if existing is not None and existing.id != team_id:
                raise ConflictError(
                    "Ya existe un equipo con ese nombre en este proyecto"
                )
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(team, field, value)
        saved = await self.repo.save_team(team)
        member_count = await self.repo.count_members(team_id)
        return self._to_team_response(saved, member_count=member_count)

    async def delete_team(self, project_id: UUID, team_id: UUID) -> None:
        team = await self._get_active_team(project_id, team_id)
        team.soft_delete()
        await self.repo.save_team(team)

    async def get_team(self, project_id: UUID, team_id: UUID) -> TeamResponse:
        team = await self._get_active_team(project_id, team_id)
        member_count = await self.repo.count_members(team_id)
        return self._to_team_response(team, member_count=member_count)

    async def search_teams(
        self, project_id: UUID, search: str | None, limit: int, offset: int
    ) -> tuple[list[TeamResponse], int]:
        teams, total = await self.repo.search_teams(project_id, search, limit, offset)
        # Un único query agrupado para todos los conteos (en vez de 1 por equipo).
        counts = await self.repo.member_counts([team.id for team in teams])
        responses = [
            self._to_team_response(team, member_count=counts.get(team.id, 0))
            for team in teams
        ]
        return responses, total

    # ── Integrantes ──────────────────────────────────────────────────────────
    async def add_member(
        self, project_id: UUID, team_id: UUID, user_id: UUID, team_role: TeamRole
    ) -> TeamMemberResponse:
        await self._get_active_team(project_id, team_id)
        if await self.repo.get_member(team_id, user_id) is not None:
            raise ConflictError("El usuario ya pertenece al equipo")
        member = await self.repo.add_member(
            TeamMember(team_id=team_id, user_id=user_id, team_role=team_role)
        )
        # Recargamos para tener los datos del usuario en la respuesta.
        refreshed = await self.repo.get_member(team_id, user_id)
        return self._to_member_response(refreshed or member)

    async def change_member_role(
        self, project_id: UUID, team_id: UUID, user_id: UUID, team_role: TeamRole
    ) -> TeamMemberResponse:
        await self._get_active_team(project_id, team_id)
        member = await self._get_member(team_id, user_id)
        member.team_role = team_role
        await self.repo.save_member(member)
        # Recargamos con el usuario incluido (save expira la relación al refrescar).
        refreshed = await self.repo.get_member(team_id, user_id)
        return self._to_member_response(refreshed or member)

    async def remove_member(
        self, project_id: UUID, team_id: UUID, user_id: UUID
    ) -> None:
        await self._get_active_team(project_id, team_id)
        member = await self._get_member(team_id, user_id)
        await self.repo.delete_member(member)

    async def list_members(
        self, project_id: UUID, team_id: UUID
    ) -> list[TeamMemberResponse]:
        await self._get_active_team(project_id, team_id)
        members = await self.repo.list_members(team_id)
        return [self._to_member_response(m) for m in members]

    # ── Helpers ──────────────────────────────────────────────────────────────
    async def _get_active_team(self, project_id: UUID, team_id: UUID) -> Team:
        team = await self.repo.get_team(project_id, team_id)
        if team is None or team.is_deleted:
            raise NotFoundError("Equipo no encontrado")
        return team

    async def _get_member(self, team_id: UUID, user_id: UUID) -> TeamMember:
        member = await self.repo.get_member(team_id, user_id)
        if member is None:
            raise NotFoundError("El usuario no pertenece al equipo")
        return member

    @staticmethod
    def _to_team_response(team: Team, member_count: int) -> TeamResponse:
        return TeamResponse(
            id=team.id,
            project_id=team.project_id,
            name=team.name,
            description=team.description,
            member_count=member_count,
        )

    @staticmethod
    def _to_member_response(member: TeamMember) -> TeamMemberResponse:
        return TeamMemberResponse(
            user_id=member.user_id,
            name=member.user.name,
            last_name=member.user.last_name,
            position=member.user.position,
            team_role=member.team_role,
        )
