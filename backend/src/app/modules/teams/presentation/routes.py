from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    require_role,
    team_repo_dependency,
    user_repo_dependency,
)
from app.modules.teams.application.use_cases import (
    AddTeamMemberUseCase,
    ChangeTeamMemberRoleUseCase,
    CreateTeamUseCase,
    DeleteTeamUseCase,
    GetTeamUseCase,
    ListTeamMembersUseCase,
    ListTeamsUseCase,
    RemoveTeamMemberUseCase,
    UpdateTeamUseCase,
)
from app.modules.teams.presentation.schemas import (
    AddTeamMemberRequest,
    ChangeTeamRoleRequest,
    CreateTeamRequest,
    PaginatedTeamsResponse,
    TeamMemberResponse,
    TeamResponse,
    UpdateTeamRequest,
)
from app.shared.pagination import Pagination, pagination_params

router = APIRouter(prefix="/projects", tags=["Teams"])

# Los equipos viven dentro de un proyecto; solo administración global los gestiona.
# (role_satisfies trata a DEVELOPER como superconjunto de admin/super_admin.)
_admin = require_role("admin", "super_admin")
_reader = require_role("admin", "super_admin", "user")


@router.post(
    "/{project_id}/teams",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team(
    project_id: UUID,
    data: CreateTeamRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await CreateTeamUseCase(repo).execute(project_id, data)


@router.get("/{project_id}/teams", response_model=PaginatedTeamsResponse)
async def list_teams(
    project_id: UUID,
    search: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo=Depends(team_repo_dependency),
    current_user=Depends(_reader),
):
    return await ListTeamsUseCase(repo).execute(project_id, search, pagination)


@router.get("/{project_id}/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    project_id: UUID,
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_reader),
):
    return await GetTeamUseCase(repo).execute(project_id, team_id)


@router.patch("/{project_id}/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    project_id: UUID,
    team_id: UUID,
    data: UpdateTeamRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await UpdateTeamUseCase(repo).execute(project_id, team_id, data)


@router.delete("/{project_id}/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    project_id: UUID,
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    await DeleteTeamUseCase(repo).execute(project_id, team_id)


# ── Integrantes ──────────────────────────────────────────────────────────────


@router.get(
    "/{project_id}/teams/{team_id}/members", response_model=list[TeamMemberResponse]
)
async def list_team_members(
    project_id: UUID,
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_reader),
):
    return await ListTeamMembersUseCase(repo).execute(project_id, team_id)


@router.post(
    "/{project_id}/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    project_id: UUID,
    team_id: UUID,
    data: AddTeamMemberRequest,
    repo=Depends(team_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    current_user=Depends(_admin),
):
    return await AddTeamMemberUseCase(repo, user_repo).execute(
        project_id, team_id, data.user_id, data.team_role
    )


@router.patch(
    "/{project_id}/teams/{team_id}/members/{user_id}",
    response_model=TeamMemberResponse,
)
async def change_team_member_role(
    project_id: UUID,
    team_id: UUID,
    user_id: UUID,
    data: ChangeTeamRoleRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await ChangeTeamMemberRoleUseCase(repo).execute(
        project_id, team_id, user_id, data.team_role
    )


@router.delete(
    "/{project_id}/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    project_id: UUID,
    team_id: UUID,
    user_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    await RemoveTeamMemberUseCase(repo).execute(project_id, team_id, user_id)
