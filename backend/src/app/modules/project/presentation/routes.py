from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    event_bus_dependency,
    project_members_repo_dependency,
    project_repo_dependency,
    require_role,
    team_repo_dependency,
    user_repo_dependency,
)
from app.modules.project.application.use_cases import (
    AddMemberToProjectUseCase,
    AssignTeamToProjectUseCase,
    CreateProjectUseCase,
    DeleteProjectUseCase,
    GetProjectByIdUseCase,
    GetProjectMembersUseCase,
    GetProjectsUseCase,
    UpdateProjectUseCase,
)
from app.modules.project.presentation.schemas import (
    AssignTeamResponse,
    CreateProjectRequest,
    ProjectMemberRequest,
    ProjectMemberResponse,
    ProjectResponse,
    UpdateProjectRequest,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: CreateProjectRequest,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await CreateProjectUseCase(repo).execute(data)


@router.get("/", response_model=List[ProjectResponse])
async def get_all_projects(
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetProjectsUseCase(repo).execute()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetProjectByIdUseCase(repo).execute(project_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: UpdateProjectRequest,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await UpdateProjectUseCase(repo).execute(project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("super_admin")),
):
    await DeleteProjectUseCase(repo).execute(project_id)


# ── Miembros del proyecto ────────────────────────────────────────────────────
@router.post("/members/", status_code=status.HTTP_201_CREATED)
async def add_project_member(
    payload: ProjectMemberRequest,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    event_bus=Depends(event_bus_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    return await AddMemberToProjectUseCase(
        user_repo=user_repo,
        member_repo=project_member_repo,
        project_repo=project_repo,
        event_bus=event_bus,
    ).execute(payload, assigned_by=current_user.id)


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def get_project_members(
    project_id: UUID,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetProjectMembersUseCase(
        project_repo=project_repo,
        user_repo=user_repo,
        member_repo=project_member_repo,
    ).execute(project_id)


@router.post(
    "/{project_id}/teams/{team_id}",
    response_model=AssignTeamResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_team_to_project(
    project_id: UUID,
    team_id: UUID,
    project_repo=Depends(project_repo_dependency),
    member_repo=Depends(project_members_repo_dependency),
    team_repo=Depends(team_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await AssignTeamToProjectUseCase(
        project_repo=project_repo, member_repo=member_repo, team_repo=team_repo
    ).execute(project_id, team_id)
