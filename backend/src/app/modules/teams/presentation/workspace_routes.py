from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    deliverable_notifier_dependency,
    get_current_user,
    project_members_repo_dependency,
    team_invitation_repo_dependency,
    team_repo_dependency,
    workspace_repo_dependency,
)
from app.modules.teams.application.invitation_use_cases import (
    ListMyInvitationsUseCase,
    RespondInvitationUseCase,
)
from app.modules.teams.application.workspace_use_cases import WorkspaceService
from app.modules.teams.infrastructure.enums import InvitationStatus
from app.modules.teams.presentation.schemas import (
    InvitationResponse,
    TeamMemberResponse,
)
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreateDeliverableRequest,
    DeliverableResponse,
    MyTeamResponse,
    TeamNotificationSettingsResponse,
    UpdateTeamNotificationSettingsRequest,
    UpdateVersionRequest,
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


# ── Invitaciones del usuario ─────────────────────────────────────────────────
# Rutas literales: van antes que /{team_id} (ver nota arriba).


@router.get("/invitations/mine", response_model=list[InvitationResponse])
async def list_my_invitations(
    status_filter: InvitationStatus | None = None,
    invitation_repo=Depends(team_invitation_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await ListMyInvitationsUseCase(invitation_repo).execute(
        current_user.id, status_filter
    )


@router.post("/invitations/{invitation_id}/accept", response_model=InvitationResponse)
async def accept_invitation(
    invitation_id: UUID,
    invitation_repo=Depends(team_invitation_repo_dependency),
    team_repo=Depends(team_repo_dependency),
    member_repo=Depends(project_members_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await RespondInvitationUseCase(
        invitation_repo, team_repo, member_repo
    ).accept(invitation_id, current_user.id)


@router.post("/invitations/{invitation_id}/reject", response_model=InvitationResponse)
async def reject_invitation(
    invitation_id: UUID,
    invitation_repo=Depends(team_invitation_repo_dependency),
    team_repo=Depends(team_repo_dependency),
    member_repo=Depends(project_members_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await RespondInvitationUseCase(
        invitation_repo, team_repo, member_repo
    ).reject(invitation_id, current_user.id)


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
    notifier=Depends(deliverable_notifier_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo, notifier).add_version(
        team_id, deliverable_id, data, current_user
    )


@router.delete(
    "/{team_id}/deliverables/{deliverable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_deliverable(
    team_id: UUID,
    deliverable_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    """Borra un entregable propio (mientras no esté ya aprobado)."""
    await WorkspaceService(repo).delete_deliverable(
        team_id, deliverable_id, current_user
    )


@router.patch(
    "/{team_id}/deliverables/{deliverable_id}/versions/{version_id}",
    response_model=DeliverableResponse,
)
async def update_version(
    team_id: UUID,
    deliverable_id: UUID,
    version_id: UUID,
    data: UpdateVersionRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    """Corrige una entrega ya subida (URL, nota, observaciones)."""
    return await WorkspaceService(repo).update_version(
        team_id, deliverable_id, version_id, data, current_user
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


# ── Preferencias de aviso del usuario actual en este equipo ──────────────────


@router.get(
    "/{team_id}/workspace/notifications",
    response_model=TeamNotificationSettingsResponse,
)
async def get_notification_settings(
    team_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).get_notifications(team_id, current_user)


@router.put(
    "/{team_id}/workspace/notifications",
    response_model=TeamNotificationSettingsResponse,
)
async def update_notification_settings(
    team_id: UUID,
    data: UpdateTeamNotificationSettingsRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo).update_notifications(
        team_id, data, current_user
    )
