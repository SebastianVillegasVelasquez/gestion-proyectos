from __future__ import annotations

from uuid import UUID

from app.modules.files.domain.policy import FilesAccess, FolderOwner, NO_OWNER
from app.modules.files.infrastructure.models import ProjectFile, ProjectFolder
from app.modules.files.infrastructure.repository import ProjectFilesRepository
from app.modules.files.presentation.schemas import (
    CreateFolderRequest,
    FileDelivery,
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
            project_role=await self._repo.project_role(project_id, current_user.id),
            team_roles=await self._repo.team_roles_in_project(
                project_id, current_user.id
            ),
            user_id=current_user.id,
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
    def _owner(
        folder: ProjectFolder | None, by_id: dict[UUID, ProjectFolder]
    ) -> FolderOwner:
        """Dueño del ancestro de primer nivel, subiendo por el árbol.

        El dueño no se copia hacia abajo a propósito: se resuelve al leer, y
        así mover una carpeta no obliga a reescribir todo su subárbol.
        """
        current = folder
        seen: set[UUID] = set()
        while current is not None and current.id not in seen:
            if current.team_id is not None or current.user_id is not None:
                return FolderOwner(current.team_id, current.user_id)
            seen.add(current.id)
            current = (
                by_id.get(current.parent_id) if current.parent_id is not None else None
            )
        return NO_OWNER

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
        deliveries = await self._repo.deliveries_by_file(project_id)

        # El recorte se hace en el PRIMER NIVEL y no archivo por archivo: como
        # cada carpeta de primer nivel es de un equipo, dejarla fuera se lleva
        # con ella todo su subárbol. Un integrante de Contenidos no tiene por
        # qué saber siquiera qué carpetas tiene TI.
        children: dict[UUID | None, list[ProjectFolder]] = {}
        for folder in folders:
            if folder.parent_id == root.id and not access.can_see(
                FolderOwner(folder.team_id, folder.user_id)
            ):
                continue
            children.setdefault(folder.parent_id, []).append(folder)
        files_by_folder: dict[UUID, list[ProjectFile]] = {}
        for file in files:
            files_by_folder.setdefault(file.folder_id, []).append(file)

        def to_file(f: ProjectFile) -> FileResponse:
            entry = deliveries.get(f.id)
            version, deliverable = entry if entry is not None else (None, None)
            return FileResponse(
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
                delivery=(
                    FileDelivery(
                        deliverable_id=deliverable.id,
                        task_title=deliverable.task_title,
                        version_number=version.version_number,
                        note=version.note,
                        observations=version.observations,
                    )
                    if version is not None and deliverable is not None
                    else None
                ),
            )

        def to_response(folder: ProjectFolder) -> FolderResponse:
            return FolderResponse(
                id=folder.id,
                parent_id=folder.parent_id,
                name=folder.name,
                team_id=folder.team_id,
                team_name=teams.get(folder.team_id) if folder.team_id else None,
                is_root=folder.parent_id is None,
                can_write=access.can_write_in(self._owner(folder, by_id)),
                created_at=folder.created_at,
                children=[to_response(c) for c in children.get(folder.id, [])],
                files=[to_file(f) for f in files_by_folder.get(folder.id, [])],
            )

        claimed = {f.team_id for f in folders if f.team_id is not None}
        return ProjectFilesResponse(
            project_id=project_id,
            root=to_response(root),
            sees_whole_project=access.sees_whole_project,
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
            if not access.can_write_in(self._owner(parent, by_id)):
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
        owner = self._owner(folder, by_id)
        # Borrar la carpeta DE un equipo es un acto de organización, como
        # crearla; borrar algo de dentro basta con pertenecer al equipo. La
        # carpeta de una persona la borra ella misma (o administración), que es
        # lo mismo que `can_write_in` ya dice.
        allowed = (
            access.can_create_team_folder(folder.team_id)
            if folder.team_id is not None
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
        if not access.can_write_in(self._owner(folder, by_id)):
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

    async def store_team_file(
        self,
        project_id: UUID,
        team_id: UUID,
        team_name: str,
        *,
        filename: str,
        content_type: str,
        content: bytes,
        uploader_id: UUID,
    ) -> ProjectFile:
        """Guarda un archivo en la carpeta del equipo, creándola si no existe.

        Es la puerta que usa el espacio de trabajo al entregar un archivo. No
        comprueba permisos: quien llama ya verificó algo más estricto (que la
        persona es integrante del equipo Y dueña del entregable). La carpeta se
        abre sola aquí —y no se le pide al líder que la cree antes— porque una
        entrega no puede quedar bloqueada por un paso de organización: el
        archivo tiene que caer en algún sitio con nombre, y el nombre correcto
        es el del equipo.
        """
        return await self._store_for_owner(
            project_id,
            FolderOwner(team_id=team_id),
            folder_name=team_name,
            filename=filename,
            content_type=content_type,
            content=content,
            uploader_id=uploader_id,
        )

    async def store_personal_file(
        self,
        project_id: UUID,
        user_id: UUID,
        user_name: str,
        *,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> ProjectFile:
        """Igual que `store_team_file`, para la entrega de una tarea INDIVIDUAL.

        Una tarea sin equipo no tiene carpeta de equipo donde caer, y dejar el
        archivo fuera del archivador sería volver al problema que este módulo
        resuelve. Cae en la carpeta de la persona, que solo ven ella y quien
        mira el proyecto entero.
        """
        return await self._store_for_owner(
            project_id,
            FolderOwner(user_id=user_id),
            folder_name=user_name,
            filename=filename,
            content_type=content_type,
            content=content,
            uploader_id=user_id,
        )

    async def _store_for_owner(
        self,
        project_id: UUID,
        owner: FolderOwner,
        *,
        folder_name: str,
        filename: str,
        content_type: str,
        content: bytes,
        uploader_id: UUID,
    ) -> ProjectFile:
        root = await self._ensure_root(project_id)
        folder = next(
            (
                f
                for f in await self._repo.list_folders(project_id)
                if FolderOwner(f.team_id, f.user_id) == owner
            ),
            None,
        )
        if folder is None:
            folder = await self._repo.add_folder(
                ProjectFolder(
                    project_id=project_id,
                    parent_id=root.id,
                    name=folder_name,
                    team_id=owner.team_id,
                    user_id=owner.user_id,
                    created_by=uploader_id,
                )
            )

        name = await self._free_name(folder.id, sanitize_filename(filename))
        key = self._storage.save(f"projects/{project_id}", name, content)
        return await self._repo.add_file(
            ProjectFile(
                folder_id=folder.id,
                project_id=project_id,
                name=name,
                content_type=content_type or "application/octet-stream",
                size_bytes=len(content),
                storage_key=key,
                uploaded_by=uploader_id,
            )
        )

    async def _free_name(self, folder_id: UUID, name: str) -> str:
        """`informe.pdf` → `informe (2).pdf` si el nombre ya está ocupado.

        Al subir a mano un choque de nombres es un error que conviene avisar;
        al entregar NO lo es: la segunda versión de un entregable suele traer
        el mismo archivo corregido, y fallar ahí obligaría a renombrar en el
        disco antes de poder entregar.
        """
        if not await self._repo.file_name_taken(folder_id, name):
            return name
        stem, dot, ext = name.rpartition(".")
        stem, ext = (stem, f"{dot}{ext}") if dot else (name, "")
        for n in range(2, 100):
            candidate = f"{stem} ({n}){ext}"
            if not await self._repo.file_name_taken(folder_id, candidate):
                return candidate
        raise ConflictError("Demasiados archivos con ese nombre en esta carpeta")

    async def get_file_for_download(
        self, project_id: UUID, file_id: UUID, current_user
    ) -> ProjectFile:
        """Descargar (o ver) es leer, y se recorta igual que el árbol.

        Filtrar solo el listado no sería seguridad: bastaría con adivinar un id
        para bajarse el archivo de otro equipo. La comprobación vive aquí, que
        es por donde pasan las dos rutas.
        """
        access = await self._require_view(project_id, current_user)
        file = await self._repo.get_file(project_id, file_id)
        if file is None:
            raise NotFoundError("Archivo no encontrado")
        folder = await self._repo.get_folder(project_id, file.folder_id)
        by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
        if not access.can_see(self._owner(folder, by_id)):
            raise ForbiddenError("Este archivo no es tuyo ni de tus equipos")
        return file

    async def delete_file(self, project_id: UUID, file_id: UUID, current_user) -> None:
        access = await self._require_view(project_id, current_user)
        file = await self._repo.get_file(project_id, file_id)
        if file is None:
            raise NotFoundError("Archivo no encontrado")
        folder = await self._repo.get_folder(project_id, file.folder_id)
        by_id = {f.id: f for f in await self._repo.list_folders(project_id)}
        if not access.can_write_in(self._owner(folder, by_id)):
            raise ForbiddenError("No puedes borrar este archivo")
        # Solo borrado lógico, igual que al borrar una carpeta: el byte se queda
        # en disco. Borrarlo aquí dejaba una incoherencia fea —la fila decía
        # "recuperable" pero el contenido ya no existía— y además hacía que dos
        # caminos de borrado se comportaran distinto. Recuperar espacio es tarea
        # de un barrido posterior sobre lo que lleva tiempo con `deleted_at`.
        file.soft_delete()
        await self._repo.save()
