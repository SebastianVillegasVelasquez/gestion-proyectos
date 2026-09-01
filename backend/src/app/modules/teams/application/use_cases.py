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
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.shared.base_repository import Repository
from app.shared.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.shared.pagination import Pagination

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin", "developer"}


async def _authorize_team_member_management(
    repo: TeamRepository, team_id: UUID, actor, target_user_id: UUID
) -> None:
    """Quién puede mover / quitar integrantes de un equipo.

    Administración global puede todo. Fuera de eso, solo el LÍDER del equipo, y
    únicamente sobre sus integrantes: ni sobre otro líder/supervisor ni sobre sí
    mismo (evita que el equipo se quede sin quien lo dirija).
    """
    system_role = getattr(actor.role, "value", actor.role)
    if system_role in _ADMIN_SYSTEM_ROLES:
        return
    actor_membership = await repo.get_member(team_id, actor.id)
    if actor_membership is None or actor_membership.team_role != TeamRole.LIDER:
        raise ForbiddenError(
            "Solo el líder del equipo puede gestionar a sus integrantes"
        )
    if target_user_id == actor.id:
        raise ForbiddenError(
            "El líder no puede cambiarse el rol ni quitarse a sí mismo del equipo"
        )
    target = await repo.get_member(team_id, target_user_id)
    if target is not None and target.team_role != TeamRole.INTEGRANTE:
        raise ForbiddenError(
            "El líder solo puede gestionar a los integrantes del equipo"
        )


class CreateTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, project_id: UUID, data: CreateTeamRequest) -> TeamResponse:
        return await self.service.create_team(project_id, data)


class UpdateTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(
        self, project_id: UUID, team_id: UUID, data: UpdateTeamRequest
    ) -> TeamResponse:
        return await self.service.update_team(project_id, team_id, data)


class DeleteTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, project_id: UUID, team_id: UUID) -> None:
        await self.service.delete_team(project_id, team_id)


class GetTeamUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, project_id: UUID, team_id: UUID) -> TeamResponse:
        return await self.service.get_team(project_id, team_id)


class ListTeamsUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(
        self, project_id: UUID, search: str | None, pagination: Pagination
    ) -> PaginatedTeamsResponse:
        items, total = await self.service.search_teams(
            project_id, search, pagination.limit, pagination.offset
        )
        return PaginatedTeamsResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class ListMyTeamsUseCase:
    """Equipos de un proyecto a los que pertenece el usuario autenticado.

    Alimenta la vista del rol User: si es uno solo, el frontend redirige directo;
    si son varios, muestra el selector.
    """

    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(self, project_id: UUID, user_id: UUID) -> list[TeamResponse]:
        return await self.service.list_teams_for_user(project_id, user_id)


class AddTeamMemberUseCase:
    """Agrega un usuario al equipo.

    Valida dos precondiciones antes de tocar el equipo:
    - el usuario existe (vive en otro bounded context);
    - el usuario ya es integrante del proyecto. Un equipo vive dentro de un
      proyecto, así que no se puede pertenecer a un equipo sin pertenecer antes
      al proyecto (evita "miembros indirectos" que luego chocan con los permisos).
    """

    def __init__(
        self,
        team_repo: TeamRepository,
        user_repo: Repository,
        project_member_repo: ProjectMemberRepository,
    ):
        self.service = TeamService(team_repo)
        self.user_repo = user_repo
        self.project_member_repo = project_member_repo

    async def execute(
        self, project_id: UUID, team_id: UUID, user_id: UUID, team_role: TeamRole
    ) -> TeamMemberResponse:
        user = await self.user_repo.get_by_id(user_id)
        if user is None or getattr(user, "is_deleted", False):
            raise NotFoundError("El usuario no existe")
        membership = (
            await self.project_member_repo.get_member_by_project_id_and_user_id(
                project_id=project_id, user_id=user_id
            )
        )
        if membership is None or membership.is_deleted:
            raise ConflictError(
                "El usuario debe ser integrante del proyecto antes de añadirlo a un equipo"
            )
        return await self.service.add_member(project_id, team_id, user_id, team_role)


class ChangeTeamMemberRoleUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.repo = team_repo
        self.service = TeamService(team_repo)

    async def execute(
        self,
        project_id: UUID,
        team_id: UUID,
        user_id: UUID,
        team_role: TeamRole,
        actor=None,
    ) -> TeamMemberResponse:
        if actor is not None:
            await _authorize_team_member_management(self.repo, team_id, actor, user_id)
        return await self.service.change_member_role(
            project_id, team_id, user_id, team_role
        )


class RemoveTeamMemberUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.repo = team_repo
        self.service = TeamService(team_repo)

    async def execute(
        self, project_id: UUID, team_id: UUID, user_id: UUID, actor=None
    ) -> None:
        if actor is not None:
            await _authorize_team_member_management(self.repo, team_id, actor, user_id)
        await self.service.remove_member(project_id, team_id, user_id)


class ListTeamMembersUseCase:
    def __init__(self, team_repo: TeamRepository):
        self.service = TeamService(team_repo)

    async def execute(
        self, project_id: UUID, team_id: UUID
    ) -> list[TeamMemberResponse]:
        return await self.service.list_members(project_id, team_id)
