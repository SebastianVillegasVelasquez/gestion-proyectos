from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from starlette import status

from app.core.config import get_settings
from app.core.dependencies import (
    deliverable_notifier_dependency,
    event_bus_dependency,
    file_storage_dependency,
    get_current_user,
    project_files_repo_dependency,
    project_members_repo_dependency,
    team_invitation_repo_dependency,
    team_repo_dependency,
    workspace_repo_dependency,
)
from app.modules.files.application.use_cases import ProjectFilesService
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
from app.shared.exceptions import ValidationError

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
    bus=Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo, notifier, bus).add_version(
        team_id, deliverable_id, data, current_user
    )


@router.post(
    "/{team_id}/deliverables/{deliverable_id}/versions/upload",
    response_model=DeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_version_file(
    team_id: UUID,
    deliverable_id: UUID,
    file: UploadFile = File(...),
    note: str | None = Form(None),
    observations: str | None = Form(None),
    repo=Depends(workspace_repo_dependency),
    files_repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    notifier=Depends(deliverable_notifier_dependency),
    bus=Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
):
    """Entrega un archivo. Va multipart y no JSON porque lleva el binario; el
    resto del flujo (compuerta de dependencias, revisión, avisos) es el mismo
    que el de una entrega por URL.

    El archivo acaba en la carpeta del equipo dentro del archivador del
    proyecto, que se crea sola la primera vez.
    """
    content = await file.read()
    limit_mb = get_settings().MAX_UPLOAD_MB
    if not content:
        raise ValidationError("El archivo está vacío")
    if len(content) > limit_mb * 1024 * 1024:
        raise ValidationError(f"El archivo supera el límite de {limit_mb} MB")

    service = WorkspaceService(
        repo,
        notifier,
        bus,
        files=ProjectFilesService(files_repo, storage),
    )
    return await service.add_file_version(
        team_id,
        deliverable_id,
        filename=file.filename or "archivo",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        note=note,
        observations=observations,
        current_user=current_user,
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
    notifier=Depends(deliverable_notifier_dependency),
    bus=Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
):
    return await WorkspaceService(repo, notifier, bus=bus).add_comment(
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
