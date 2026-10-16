from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.modules.files.domain.policy import FilesAccess
from app.modules.files.infrastructure.models import ProjectFolder
from app.modules.files.infrastructure.repository import ProjectFilesRepository
from app.shared.exceptions import ForbiddenError

_NAME_MAX = 200


@dataclass(frozen=True)
class StructureFoldersResult:
    created: int
    existing: int
    skipped_task_elements: int


class StructureFolderGenerator:
    """Crea en el archivador la jerarquía de carpetas de la estructura.

    Padre → hijo → nieto de la estructura se vuelven carpetas anidadas
    compartidas por todos los equipos. Es idempotente: una carpeta ya generada
    para un elemento se reutiliza, así que volver a pulsar el botón solo añade
    lo que haya aparecido desde la última vez.
    """

    def __init__(self, repo: ProjectFilesRepository) -> None:
        self._repo = repo

    async def generate(
        self,
        project_id: UUID,
        root: ProjectFolder,
        *,
        access: FilesAccess,
        include_task_elements: bool,
        created_by: UUID,
    ) -> StructureFoldersResult:
        if not access.can_manage_structure_folders:
            raise ForbiddenError(
                "Solo la administración o quien coordina el proyecto puede generar las carpetas"
            )

        items = await self._repo.list_work_items(project_id)
        task_elements = await self._repo.task_element_ids(project_id)
        children: dict[UUID | None, list] = {}
        for item in items:
            children.setdefault(item.parent_id, []).append(item)

        folders = await self._repo.list_folders(project_id)
        folder_by_item = {
            f.work_item_id: f for f in folders if f.work_item_id is not None
        }

        created = existing = skipped = 0
        # Pila explícita (padre-primero): evita recursión en estructuras profundas.
        stack = [(item, root) for item in reversed(children.get(None, []))]
        while stack:
            item, parent_folder = stack.pop()
            if not include_task_elements and item.id in task_elements:
                skipped += 1
                continue
            folder = folder_by_item.get(item.id)
            if folder is None:
                folder = await self._repo.add_folder(
                    ProjectFolder(
                        project_id=project_id,
                        parent_id=parent_folder.id,
                        work_item_id=item.id,
                        name=await self._free_name(parent_folder.id, item.nombre),
                        created_by=created_by,
                    )
                )
                created += 1
            else:
                existing += 1
            stack.extend(
                (child, folder) for child in reversed(children.get(item.id, []))
            )

        return StructureFoldersResult(created, existing, skipped)

    async def _free_name(self, parent_id: UUID, raw: str) -> str:
        """Nombre del elemento, con sufijo si ya hay una carpeta igual al lado
        (dos elementos hermanos pueden llamarse igual; dos carpetas, no)."""
        base = raw.strip()[:_NAME_MAX] or "Sin nombre"
        if not await self._repo.sibling_exists(parent_id, base):
            return base
        for n in range(2, 100):
            candidate = f"{base[: _NAME_MAX - 6]} ({n})"
            if not await self._repo.sibling_exists(parent_id, candidate):
                return candidate
        return f"{base[: _NAME_MAX - 6]} ({parent_id.hex[:4]})"
