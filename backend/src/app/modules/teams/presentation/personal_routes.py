"""Entregables personales (sin equipo): la pantalla de entrega para quien
tiene una tarea individual. Reutiliza la lógica de versiones/comentarios/
revisión del espacio de trabajo, pero con autorización propia
(`PersonalDeliverableService`)."""

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
    workspace_repo_dependency,
)
from app.modules.files.application.use_cases import ProjectFilesService
from app.modules.teams.application.personal_use_cases import PersonalDeliverableService
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreatePersonalDeliverableRequest,
    PersonalDeliverableResponse,
    SetApprovalRequest,
    UpdateVersionRequest,
)
from app.shared.exceptions import ValidationError

router = APIRouter(prefix="/me/deliverables", tags=["Entregables personales"])


@router.get("", response_model=list[PersonalDeliverableResponse])
async def list_my_deliverables(
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await PersonalDeliverableService(repo).list_mine(current_user)


@router.get("/review-queue", response_model=list[PersonalDeliverableResponse])
async def list_review_queue(
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    """Entregables personales que este usuario puede revisar (es coordinador o
    supervisor del proyecto de la tarea) y que están esperando revisión."""
    return await PersonalDeliverableService(repo).list_review_queue(current_user)


@router.post(
    "", response_model=PersonalDeliverableResponse, status_code=status.HTTP_201_CREATED
)
async def create_my_deliverable(
    data: CreatePersonalDeliverableRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await PersonalDeliverableService(repo).create(data, current_user)


@router.patch("/{deliverable_id}/approval", response_model=PersonalDeliverableResponse)
async def set_deliverable_approval(
    deliverable_id: UUID,
    data: SetApprovalRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    """Toggle de revisión de la tarea vinculada (True → pasa por revisión de un
    responsable del proyecto; False → entregar la completa directo)."""
    return await PersonalDeliverableService(repo).set_approval(
        deliverable_id, data.requires_approval, current_user
    )


@router.post(
    "/{deliverable_id}/versions",
    response_model=PersonalDeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_my_version(
    deliverable_id: UUID,
    data: AddVersionRequest,
    repo=Depends(workspace_repo_dependency),
    bus=Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
):
    return await PersonalDeliverableService(repo, bus).add_version(
        deliverable_id, data, current_user
    )


@router.post(
    "/{deliverable_id}/versions/upload",
    response_model=PersonalDeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_my_version(
    deliverable_id: UUID,
    file: UploadFile = File(...),
    note: str | None = Form(None),
    observations: str | None = Form(None),
    repo=Depends(workspace_repo_dependency),
    files_repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    bus=Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
):
    """Entrega un ARCHIVO en una tarea individual. Va multipart y no JSON
    porque lleva el binario; el resto del flujo (compuerta de dependencias,
    revisión, cascada de fechas) es el mismo que el de una entrega por URL.

    El archivo acaba en la carpeta de la persona dentro del archivador del
    proyecto, que se crea sola la primera vez.
    """
    content = await file.read()
    limit_mb = get_settings().MAX_UPLOAD_MB
    if not content:
        raise ValidationError("El archivo está vacío")
    if len(content) > limit_mb * 1024 * 1024:
        raise ValidationError(f"El archivo supera el límite de {limit_mb} MB")

    service = PersonalDeliverableService(
        repo, bus, files=ProjectFilesService(files_repo, storage)
    )
    return await service.add_file_version(
        deliverable_id,
        filename=file.filename or "archivo",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        note=note,
        observations=observations,
        current_user=current_user,
    )


@router.patch(
    "/{deliverable_id}/versions/{version_id}",
    response_model=PersonalDeliverableResponse,
)
async def update_my_version(
    deliverable_id: UUID,
    version_id: UUID,
    data: UpdateVersionRequest,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    return await PersonalDeliverableService(repo).update_version(
        deliverable_id, version_id, data, current_user
    )


@router.delete("/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_deliverable(
    deliverable_id: UUID,
    repo=Depends(workspace_repo_dependency),
    current_user=Depends(get_current_user),
):
    await PersonalDeliverableService(repo).delete(deliverable_id, current_user)


@router.post(
    "/{deliverable_id}/comments",
    response_model=PersonalDeliverableResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_my_comment(
    deliverable_id: UUID,
    data: AddCommentRequest,
    repo=Depends(workspace_repo_dependency),
    bus=Depends(event_bus_dependency),
    notifier=Depends(deliverable_notifier_dependency),
    current_user=Depends(get_current_user),
):
    return await PersonalDeliverableService(repo, bus, notifier=notifier).add_comment(
        deliverable_id, data, current_user
    )
