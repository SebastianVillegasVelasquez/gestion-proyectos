from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import get_current_user, workspace_repo_dependency
from app.modules.teams.application.workspace_use_cases import WorkspaceService
from app.modules.teams.presentation.schemas import TeamMemberResponse
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreateDeliverableRequest,
    DeliverableResponse,
    MyTeamResponse,
    WorkspaceAccessResponse,
)

router = APIRouter(prefix="/teams", tags=["Teams · Workspace"])


# Ruta literal: debe registrarse antes que /{team_id} (workspace_router se incluye
# antes que teams_router en main.py para que "mine" no se interprete como UUID).
@router.get("/mine", response_model=list[MyTeamResponse])
async def list_my_teams(
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).list_my_teams(current_user)


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    team_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).list_members(team_id, current_user)


@router.get("/{team_id}/workspace/access", response_model=WorkspaceAccessResponse)
async def get_access(
    team_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).access(team_id, current_user)


@router.get("/{team_id}/deliverables", response_model=list[DeliverableResponse])
async def list_deliverables(
    team_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).list_deliverables(team_id, current_user)


@router.post(
    "/{team_id}/deliverables",
    response_model=DeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_deliverable(
    team_id: UUID,
    data: CreateDeliverableRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).create_deliverable(team_id, data, current_user)


@router.get(
    "/{team_id}/deliverables/{deliverable_id}", response_model=DeliverableResponse
)
async def get_deliverable(
    team_id: UUID,
    deliverable_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).get_deliverable(
        team_id, deliverable_id, current_user
    )


@router.post(
    "/{team_id}/deliverables/{deliverable_id}/versions",
    response_model=DeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_version(
    team_id: UUID,
    deliverable_id: UUID,
    data: AddVersionRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).add_version(
        team_id, deliverable_id, data, current_user
    )


@router.post(
    "/{team_id}/deliverables/{deliverable_id}/comments",
    response_model=DeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    team_id: UUID,
    deliverable_id: UUID,
    data: AddCommentRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).add_comment(
        team_id, deliverable_id, data, current_user
    )
