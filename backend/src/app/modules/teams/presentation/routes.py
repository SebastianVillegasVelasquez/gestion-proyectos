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

router = APIRouter(prefix="/teams", tags=["Teams"])

# Solo administración global gestiona equipos predefinidos.
_admin = require_role("admin", "super_admin")


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: CreateTeamRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await CreateTeamUseCase(repo).execute(data)


@router.get("/", response_model=PaginatedTeamsResponse)
async def list_teams(
    search: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo=Depends(team_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    return await ListTeamsUseCase(repo).execute(search, pagination)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetTeamUseCase(repo).execute(team_id)


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    data: UpdateTeamRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await UpdateTeamUseCase(repo).execute(team_id, data)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    await DeleteTeamUseCase(repo).execute(team_id)


# ── Integrantes ──────────────────────────────────────────────────────────────


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    team_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    return await ListTeamMembersUseCase(repo).execute(team_id)


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    data: AddTeamMemberRequest,
    repo=Depends(team_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    current_user=Depends(_admin),
):
    return await AddTeamMemberUseCase(repo, user_repo).execute(
        team_id, data.user_id, data.team_role
    )


@router.patch("/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def change_team_member_role(
    team_id: UUID,
    user_id: UUID,
    data: ChangeTeamRoleRequest,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    return await ChangeTeamMemberRoleUseCase(repo).execute(
        team_id, user_id, data.team_role
    )


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    repo=Depends(team_repo_dependency),
    current_user=Depends(_admin),
):
    await RemoveTeamMemberUseCase(repo).execute(team_id, user_id)
