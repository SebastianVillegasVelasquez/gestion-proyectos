from typing import List
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import FileResponse as FileDownloadResponse
from starlette import status

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import (
    file_storage_dependency,
    project_repo_dependency,
    require_role,
)
from app.modules.project.incidents.application.service import ProjectIncidentService
from app.modules.project.incidents.infrastructure.repository import IncidentRepository
from app.modules.project.incidents.presentation.schemas import (
    CreateIncidentRequest,
    IncidentResponse,
    UpdateIncidentRequest,
)
from app.shared.exceptions import ValidationError

router = APIRouter(
    prefix="/projects/{project_id}/incidents",
    tags=["Project · Incidents"],
    # Toda la bitácora es de administración: es información contractual.
    dependencies=[Depends(require_role("admin", "super_admin"))],
)


def incident_service(
    db=Depends(get_db),
    project_repo=Depends(project_repo_dependency),
    storage=Depends(file_storage_dependency),
) -> ProjectIncidentService:
    return ProjectIncidentService(IncidentRepository(db), project_repo, storage)


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    project_id: UUID, service: ProjectIncidentService = Depends(incident_service)
):
    """Bitácora de incidentes del proyecto (el más reciente primero)."""
    return await service.list(project_id)


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    project_id: UUID,
    data: CreateIncidentRequest,
    service: ProjectIncidentService = Depends(incident_service),
    current_user=Depends(require_role("admin", "super_admin")),
):
    return await service.create(project_id, data, current_user.id)


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    project_id: UUID,
    incident_id: UUID,
    data: UpdateIncidentRequest,
    service: ProjectIncidentService = Depends(incident_service),
):
    return await service.update(project_id, incident_id, data)


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    project_id: UUID,
    incident_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
):
    await service.delete(project_id, incident_id)


@router.post("/{incident_id}/apply", response_model=IncidentResponse)
async def apply_incident_to_schedule(
    project_id: UUID,
    incident_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
):
    """Suma los días de impacto a la fecha de fin del proyecto."""
    return await service.apply_to_schedule(project_id, incident_id)


@router.post("/{incident_id}/revert", response_model=IncidentResponse)
async def revert_incident_from_schedule(
    project_id: UUID,
    incident_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
):
    """Quita del cronograma los días que se habían reflejado."""
    return await service.revert_from_schedule(project_id, incident_id)


@router.post(
    "/{incident_id}/attachments",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    project_id: UUID,
    incident_id: UUID,
    file: UploadFile,
    service: ProjectIncidentService = Depends(incident_service),
    current_user=Depends(require_role("admin", "super_admin")),
):
    content = await file.read()
    limit_mb = get_settings().MAX_UPLOAD_MB
    if len(content) > limit_mb * 1024 * 1024:
        raise ValidationError(f"El archivo supera el límite de {limit_mb} MB")
    if not content:
        raise ValidationError("El archivo está vacío")
    return await service.add_attachment(
        project_id,
        incident_id,
        filename=file.filename or "evidencia",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        uploader_id=current_user.id,
    )


# Solo estos tipos se muestran en el navegador; el resto (HTML, SVG…) siempre se
# descarga, porque un archivo subido y servido inline desde nuestro origen podría
# ejecutar scripts.
_INLINE_SAFE = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "application/pdf",
        "text/plain",
    }
)


async def _serve(
    project_id: UUID,
    incident_id: UUID,
    attachment_id: UUID,
    service: ProjectIncidentService,
    storage,
    *,
    inline: bool,
):
    attachment = await service.get_attachment(project_id, incident_id, attachment_id)
    can_inline = inline and attachment.content_type in _INLINE_SAFE
    disposition = "inline" if can_inline else "attachment"
    return FileDownloadResponse(
        path=storage.path(attachment.storage_key),
        media_type=attachment.content_type,
        filename=attachment.name,
        headers={
            "Content-Disposition": (
                f"{disposition}; filename*=UTF-8''{quote(attachment.name)}"
            )
        },
    )


@router.get("/{incident_id}/attachments/{attachment_id}/view")
async def view_attachment(
    project_id: UUID,
    incident_id: UUID,
    attachment_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
    storage=Depends(file_storage_dependency),
):
    return await _serve(
        project_id, incident_id, attachment_id, service, storage, inline=True
    )


@router.get("/{incident_id}/attachments/{attachment_id}/download")
async def download_attachment(
    project_id: UUID,
    incident_id: UUID,
    attachment_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
    storage=Depends(file_storage_dependency),
):
    return await _serve(
        project_id, incident_id, attachment_id, service, storage, inline=False
    )


@router.delete(
    "/{incident_id}/attachments/{attachment_id}", response_model=IncidentResponse
)
async def delete_attachment(
    project_id: UUID,
    incident_id: UUID,
    attachment_id: UUID,
    service: ProjectIncidentService = Depends(incident_service),
):
    return await service.delete_attachment(project_id, incident_id, attachment_id)
