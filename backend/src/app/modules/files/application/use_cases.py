from __future__ import annotations

from uuid import UUID

from app.modules.files.domain.policy import FilesAccess
from app.modules.files.infrastructure.models import ProjectFile, ProjectFolder
from app.modules.files.infrastructure.repository import ProjectFilesRepository
from app.modules.files.presentation.schemas import (
    CreateFolderRequest,
    FileResponse,
    FolderResponse,
    ProjectFilesResponse,
    TeamOption,
)
from app.shared.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.shared.storage import FileStorage, sanitize_filename

ROOT_FOLDER_NAME = "Archivos del proyecto"


class ProjectFilesService:
    """Casos de uso del archivador de un proyecto.

    Un único servicio porque todas las operaciones comparten la misma pregunta
    previa —«¿dónde estás parado y de quién es esa carpeta?»— y partirlo en
    cinco clases solo repetiría esa resolución de contexto cinco veces.
    """

    def __init__(self, repo: ProjectFilesRepository, storage: FileStorage) -> None:
        self._repo = repo
        self._storage = storage

    # ── contexto y política ──────────────────────────────────────────────────

    async def _access(self, project_id: UUID, current_user) -> FilesAccess:
        return FilesAccess.resolve(
            current_user.role.value,
            is_project_member=await self._repo.is_project_member(
                project_id, current_user.id
            ),
            team_roles=await self._repo.team_roles_in_project(
                project_id, current_user.id
            ),
        )

    async def _require_view(self, project_id: UUID, current_user) -> FilesAccess:
        access = await self._access(project_id, current_user)
        if not access.can_view:
            raise ForbiddenError("No tienes acceso a los archivos de este proyecto")
        return access

    async def _ensure_root(self, project_id: UUID) -> ProjectFolder:
        """La raíz se crea al primer acceso, no al crear el proyecto: así los
        proyectos que ya existen la tienen sin necesidad de una migración de
        datos, y un proyecto que nunca abre sus archivos no gasta una fila."""
        root = await self._repo.get_root(project_id)
        if root is not None:
            return root
        return await self._repo.add_folder(
            ProjectFolder(project_id=project_id, name=ROOT_FOLDER_NAME)
        )

    @staticmethod
    def _owner_team_id(
        folder: ProjectFolder, by_id: dict[UUID, ProjectFolder]
    ) -> UUID | None:
        """Equipo dueño del ancestro de primer nivel, subiendo por el árbol.

        El `team_id` no se copia hacia abajo a propósito: se resuelve al leer,
        y así mover una carpeta no obliga a reescribir todo su subárbol.
        """
        current: ProjectFolder | None = folder
        seen: set[UUID] = set()
        while current is not None and current.id not in seen:
            if current.team_id is not None:
                return current.team_id
            seen.add(current.id)
            current = (
                by_id.get(current.parent_id) if current.parent_id is not None else None
            )
        return None

    # ── lectura ──────────────────────────────────────────────────────────────

    async def get_tree(self, project_id: UUID, current_user) -> ProjectFilesResponse:
        access = await self._require_view(project_id, current_user)
        root = await self._ensure_root(project_id)

        folders = await self._repo.list_folders(project_id)
        if all(f.id != root.id for f in folders):
            folders = [root, *folders]
        files = await self._repo.list_files(project_id)

        by_id = {f.id: f for f in folders}
        teams = {t.id: t.name for t in await self._repo.list_project_teams(project_id)}

        children: dict[UUID | None, list[ProjectFolder]] = {}
        for folder in folders:
            children.setdefault(folder.parent_id, []).append(folder)
        files_by_folder: dict[UUID, list[ProjectFile]] = {}
        for file in files:
            files_by_folder.setdefault(file.folder_id, []).append(file)

        def to_response(folder: ProjectFolder) -> FolderResponse:
            return FolderResponse(
                id=folder.id,
                parent_id=folder.parent_id,
                name=folder.name,
                team_id=folder.team_id,
                team_name=teams.get(folder.team_id) if folder.team_id else None,
                is_root=folder.parent_id is None,
                can_write=access.can_write_in(self._owner_team_id(folder, by_id)),
                created_at=folder.created_at,
                children=[to_response(c) for c in children.get(folder.id, [])],
                files=[
                    FileResponse(
                        id=f.id,
                        folder_id=f.folder_id,
                        name=f.name,
                        content_type=f.content_type,
                        size_bytes=f.size_bytes,
                        uploaded_by=f.uploaded_by,
                        uploaded_by_name=(
                            f"{f.author.name} {f.author.last_name}"
                            if f.author is not None
                            else None
                        ),
                        created_at=f.created_at,
                    )
                    for f in files_by_folder.get(folder.id, [])
                ],
            )

        claimed = {f.team_id for f in folders if f.team_id is not None}
        return ProjectFilesResponse(
            project_id=project_id,
            root=to_response(root),
            teams_without_folder=[
                TeamOption(id=tid, name=name)
                for tid, name in teams.items()
                if tid not in claimed and access.can_create_team_folder(tid)
            ],
        )

    # ── escritura ────────────────────────────────────────────────────────────

    async def create_folder(
        self, project_id: UUID, data: CreateFolderRequest, current_user
    ) -> FolderResponse:
        access = await self._require_view(project_id, current_user)
        root = await self._ensure_root(project_id)
        parent_id = data.parent_id or root.id

        parent = await self._repo.get_folder(project_id, parent_id)
        if parent is None:
            raise NotFoundError("La carpeta contenedora no existe")

        if parent.parent_id is None:
            # Primer nivel: solo carpetas de equipo, una por equipo. Es la regla
            # que mantiene la raíz legible; sin ella el archivador se aplana.
            if data.team_id is None:
                raise ForbiddenError(
                    "En la raíz del proyecto solo se crean carpetas de equipo"
                )
            if not access.can_create_team_folder(data.team_id):
                raise ForbiddenError(
                    "Solo el líder o el supervisor del equipo puede crear su carpeta"
                )
            teams = {t.id for t in await self._repo.list_project_teams(project_id)}
            if data.team_id not in teams:
                raise NotFoundError("Ese equipo no pertenece a este proyecto")
            existing = await self._repo.list_folders(project_id)
            if any(f.team_id == data.team_id for f in existing):
                raise ConflictError("Ese equipo ya tiene su carpeta")
            team_id = data.team_id
        else:
            by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
            if not access.can_write_in(self._owner_team_id(parent, by_id)):
                raise ForbiddenError("No puedes crear carpetas aquí")
            # Dentro de la carpeta de un equipo el dueño ya está definido por el
            # ancestro: marcarlo otra vez crearía dos dueños para un mismo rama.
            team_id = None

        name = data.name.strip()
        if await self._repo.sibling_exists(parent.id, name):
            raise ConflictError("Ya hay una carpeta con ese nombre aquí")

        folder = await self._repo.add_folder(
            ProjectFolder(
                project_id=project_id,
                parent_id=parent.id,
                name=name,
                team_id=team_id,
                created_by=current_user.id,
            )
        )
        return FolderResponse(
            id=folder.id,
            parent_id=folder.parent_id,
            name=folder.name,
            team_id=folder.team_id,
            team_name=None,
            is_root=False,
            can_write=True,
            created_at=folder.created_at,
        )

    async def delete_folder(
        self, project_id: UUID, folder_id: UUID, current_user
    ) -> None:
        access = await self._require_view(project_id, current_user)
        folder = await self._repo.get_folder(project_id, folder_id)
        if folder is None:
            raise NotFoundError("Carpeta no encontrada")
        if folder.parent_id is None:
            raise ForbiddenError("La carpeta raíz del proyecto no se borra")

        by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
        owner = self._owner_team_id(folder, by_id)
        # Borrar la carpeta DE un equipo es un acto de organización, como
        # crearla; borrar algo de dentro basta con pertenecer al equipo.
        allowed = (
            access.can_create_team_folder(owner)
            if folder.team_id is not None and owner is not None
            else access.can_write_in(owner)
        )
        if not allowed:
            raise ForbiddenError("No puedes borrar esta carpeta")

        # Borrado lógico en cascada por el subárbol: el contenido no debe quedar
        # colgando de una carpeta que ya no se ve. Los bytes se conservan (el
        # borrado es reversible en base de datos si hiciera falta).
        stack = [folder]
        while stack:
            current = stack.pop()
            current.soft_delete()
            stack.extend(f for f in by_id.values() if f.parent_id == current.id)
        for file in await self._repo.list_files(project_id):
            if file.folder_id in {f.id for f in by_id.values() if f.is_deleted}:
                file.soft_delete()
        await self._repo.save()

    async def upload_file(
        self,
        project_id: UUID,
        folder_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
        current_user,
    ) -> FileResponse:
        access = await self._require_view(project_id, current_user)
        folder = await self._repo.get_folder(project_id, folder_id)
        if folder is None:
            raise NotFoundError("Carpeta no encontrada")

        by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
        if not access.can_write_in(self._owner_team_id(folder, by_id)):
            raise ForbiddenError("No puedes subir archivos aquí")

        name = sanitize_filename(filename)
        if await self._repo.file_name_taken(folder.id, name):
            raise ConflictError("Ya hay un archivo con ese nombre en esta carpeta")

        # Primero el byte, después la fila. Si la transacción se cayera después,
        # queda un blob huérfano en disco —recuperable y sin efecto visible—; al
        # revés quedaría una fila apuntando a un archivo que no existe, que sí
        # rompe la descarga.
        key = self._storage.save(f"projects/{project_id}", name, content)
        file = await self._repo.add_file(
            ProjectFile(
                folder_id=folder.id,
                project_id=project_id,
                name=name,
                content_type=content_type or "application/octet-stream",
                size_bytes=len(content),
                storage_key=key,
                uploaded_by=current_user.id,
            )
        )
        return FileResponse(
            id=file.id,
            folder_id=file.folder_id,
            name=file.name,
            content_type=file.content_type,
            size_bytes=file.size_bytes,
            uploaded_by=file.uploaded_by,
            uploaded_by_name=f"{current_user.name} {current_user.last_name}",
            created_at=file.created_at,
        )

    async def get_file_for_download(
        self, project_id: UUID, file_id: UUID, current_user
    ) -> ProjectFile:
        """Descargar es leer: quien ve el archivador ve sus archivos. La
        descarga pasa por la API (y no por una URL pública) justamente para que
        esta comprobación exista."""
        await self._require_view(project_id, current_user)
        file = await self._repo.get_file(project_id, file_id)
        if file is None:
            raise NotFoundError("Archivo no encontrado")
        return file

    async def delete_file(self, project_id: UUID, file_id: UUID, current_user) -> None:
        access = await self._require_view(project_id, current_user)
        file = await self._repo.get_file(project_id, file_id)
        if file is None:
            raise NotFoundError("Archivo no encontrado")
        folder = await self._repo.get_folder(project_id, file.folder_id)
        by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
        owner = self._owner_team_id(folder, by_id) if folder else None
        if not access.can_write_in(owner):
            raise ForbiddenError("No puedes borrar este archivo")
        file.soft_delete()
        await self._repo.save()
        self._storage.delete(file.storage_key)
