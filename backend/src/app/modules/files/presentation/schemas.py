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


class FileDelivery(BaseModelConfig):
    """De qué entrega del espacio de trabajo salió un archivo.

    Es lo que convierte el archivador en algo revisable: quien lidera abre la
    carpeta de su equipo y ve, en cada archivo, de qué tarea es y qué versión,
    con el título y las observaciones que escribió quien entregó.
    """

    deliverable_id: UUID
    task_title: str
    version_number: int
    # Título/detalle que puso quien entregó, y sus instrucciones para el
    # siguiente rol. Datos internos del equipo: el archivador nunca es público.
    note: Optional[str] = None
    observations: Optional[str] = None


class FileResponse(BaseModelConfig):
    id: UUID
    folder_id: UUID
    name: str
    content_type: str
    size_bytes: int
    uploaded_by: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    created_at: datetime
    # Presente solo si el archivo llegó por una entrega (V1, V2…).
    delivery: Optional[FileDelivery] = None


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


class TeamOption(BaseModelConfig):
    id: UUID
    name: str


class ProjectFilesResponse(BaseModelConfig):
    """El archivador del proyecto en una sola respuesta, ya recortado a lo que
    quien pregunta puede ver.

    El árbol de un proyecto son decenas de nodos, no miles: traerlo entero evita
    una petición por carpeta abierta y deja la navegación instantánea.
    """

    project_id: UUID
    root: FolderResponse
    # True cuando se está viendo el archivador COMPLETO (administración,
    # coordinación o supervisión del proyecto). False = recortado a los equipos
    # de quien mira. La UI lo dice en pantalla en vez de dejar creer que el
    # proyecto solo tiene esas carpetas.
    sees_whole_project: bool = False
    # Equipos del proyecto que aún no tienen carpeta y que el usuario podría
    # abrir. Vacío para quien no puede crear ninguna.
    teams_without_folder: list[TeamOption] = []
