from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.files.infrastructure.models import ProjectFile
from app.modules.files.infrastructure.repository import ProjectFilesRepository


async def link_approved_deliverable(
    session: AsyncSession, deliverable
) -> ProjectFile | None:
    """Enlaza el archivo FINAL de un entregable aprobado en la carpeta de su elemento.

    Mientras se trabaja, los archivos (versiones, evidencias de avance) viven en
    la carpeta del equipo o de la persona. Cuando el entregable se aprueba, la
    última versión con archivo queda además enlazada en la carpeta que la
    estructura le reservó, visible para todos los equipos del proyecto.

    El enlace es una fila nueva que apunta al MISMO contenido (`storage_key`):
    no se duplican bytes, y borrar o renombrar uno no afecta al otro. Si la
    tarea no tiene elemento, o su carpeta aún no se generó, no hay nada que
    hacer: la entrega se queda donde estaba.

    Idempotente: aprobar dos veces (o re-aprobar tras una devolución) no repite
    el enlace.
    """
    if deliverable.task_id is None:
        return None
    repo = ProjectFilesRepository(session)

    final_file_id = await repo.latest_delivered_file_id(deliverable.id)
    if final_file_id is None:
        return None

    located = await repo.task_work_item(deliverable.task_id)
    if located is None:
        return None
    project_id, work_item_id = located
    if work_item_id is None:
        return None
    folder = await repo.get_folder_for_work_item(project_id, work_item_id)
    if folder is None:
        return None

    source = await session.get(ProjectFile, final_file_id)
    if source is None or source.deleted_at is not None:
        return None
    if await repo.has_file_with_storage(folder.id, source.storage_key):
        return None

    return await repo.add_file(
        ProjectFile(
            folder_id=folder.id,
            project_id=project_id,
            name=await repo.free_file_name(folder.id, source.name),
            content_type=source.content_type,
            size_bytes=source.size_bytes,
            storage_key=source.storage_key,
            uploaded_by=source.uploaded_by,
            task_id=deliverable.task_id,
        )
    )
