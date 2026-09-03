from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints

from app.shared.base_model import BaseModelConfig

FolderName = Annotated[str, StringConstraints(min_length=1, max_length=200)]


class CreateFolderRequest(BaseModelConfig):
    name: FolderName
    # Carpeta contenedora. Omitida = la raíz del proyecto, y entonces `team_id`
    # es obligatorio: en la raíz solo cuelgan carpetas de equipo.
    parent_id: Optional[UUID] = None
    team_id: Optional[UUID] = None


class RenameFolderRequest(BaseModelConfig):
    name: FolderName


class FileResponse(BaseModelConfig):
    id: UUID
    folder_id: UUID
    name: str
    content_type: str
    size_bytes: int
    uploaded_by: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime


class FolderResponse(BaseModelConfig):
    id: UUID
    parent_id: Optional[UUID] = None
    name: str
    team_id: Optional[UUID] = None
    team_name: Optional[str] = None
    is_root: bool
    # Permisos ya resueltos por el servidor para ESTA carpeta: la UI no vuelve a
    # deducir la política (y así no puede contradecirla).
    can_write: bool
    created_at: datetime
    children: list["FolderResponse"] = []
    files: list[FileResponse] = []


class ProjectFilesResponse(BaseModelConfig):
    """El archivador completo del proyecto en una sola respuesta.

    El árbol de un proyecto son decenas de nodos, no miles: traerlo entero evita
    una petición por carpeta abierta y deja la navegación instantánea.
    """

    project_id: UUID
    root: FolderResponse
    # Equipos del proyecto que aún no tienen carpeta y que el usuario podría
    # abrir. Vacío para quien no puede crear ninguna.
    teams_without_folder: list["TeamOption"] = []


class TeamOption(BaseModelConfig):
    id: UUID
    name: str
