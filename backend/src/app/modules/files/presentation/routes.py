from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import FileResponse as FileDownloadResponse
from starlette import status

from app.core.config import get_settings
from app.core.dependencies import (
    file_storage_dependency,
    get_current_user,
    project_files_repo_dependency,
)
from app.modules.files.application.use_cases import ProjectFilesService
from app.modules.files.presentation.schemas import (
    CreateFolderRequest,
    FileResponse,
    FolderResponse,
    ProjectFilesResponse,
)
from app.shared.exceptions import ValidationError

router = APIRouter(prefix="/projects/{project_id}/files", tags=["Project · Files"])


def _service(repo, storage) -> ProjectFilesService:
    return ProjectFilesService(repo, storage)


@router.get("", response_model=ProjectFilesResponse)
async def get_project_files(
    project_id: UUID,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    """El archivador completo del proyecto: la raíz, las carpetas de cada equipo
    y sus archivos, con los permisos ya resueltos por carpeta."""
    return await _service(repo, storage).get_tree(project_id, current_user)


@router.post(
    "/folders", response_model=FolderResponse, status_code=status.HTTP_201_CREATED
)
async def create_folder(
    project_id: UUID,
    data: CreateFolderRequest,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    """Crea una carpeta. En la raíz solo se admite la carpeta de un equipo (una
    por equipo, la abre su líder o supervisor); más abajo, cualquier integrante
    del equipo dueño organiza como quiera."""
    return await _service(repo, storage).create_folder(project_id, data, current_user)


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    project_id: UUID,
    folder_id: UUID,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    await _service(repo, storage).delete_folder(project_id, folder_id, current_user)


@router.post(
    "/folders/{folder_id}/upload",
    response_model=FileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    project_id: UUID,
    folder_id: UUID,
    file: UploadFile,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    content = await file.read()
    limit = get_settings().MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > limit:
        raise ValidationError(
            f"El archivo supera el límite de {get_settings().MAX_UPLOAD_MB} MB"
        )
    if not content:
        raise ValidationError("El archivo está vacío")
    return await _service(repo, storage).upload_file(
        project_id,
        folder_id,
        filename=file.filename or "archivo",
        content_type=file.content_type or "application/octet-stream",
        content=content,
        current_user=current_user,
    )


@router.get("/{file_id}/download")
async def download_file(
    project_id: UUID,
    file_id: UUID,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    """Descarga autenticada: el archivo de un proyecto no se sirve por una URL
    pública, se pide con la sesión y el servidor comprueba el acceso."""
    service = _service(repo, storage)
    file = await service.get_file_for_download(project_id, file_id, current_user)
    return FileDownloadResponse(
        path=storage.path(file.storage_key),
        media_type=file.content_type,
        filename=file.name,
        headers={
            # El nombre puede llevar acentos: `filename*` es la forma que los
            # navegadores entienden sin destrozarlos.
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.name)}"
        },
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    project_id: UUID,
    file_id: UUID,
    repo=Depends(project_files_repo_dependency),
    storage=Depends(file_storage_dependency),
    current_user=Depends(get_current_user),
):
    await _service(repo, storage).delete_file(project_id, file_id, current_user)
