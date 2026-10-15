"""Avance declarado de una tarea, siempre con evidencia.

El sistema calcula el avance por estado, pero quien hace el trabajo sabe mejor
cuánto lleva. Se le deja declararlo con una condición: cada edición va
respaldada por algo verificable —un archivo vinculado a la tarea o una versión
de su entregable— y queda en una bitácora (`TaskProgressUpdate`). Sin evidencia
no hay edición: así el porcentaje deja de ser una opinión.
"""

from dataclasses import dataclass
from uuid import UUID

from app.modules.files.application.use_cases import ProjectFilesService
from app.modules.files.infrastructure.models import ProjectFile
from app.modules.tasks.domain import rules
from app.modules.tasks.domain.services import compute_task_progress
from app.modules.tasks.infrastructure.models import Task, TaskProgressUpdate
from app.modules.tasks.infrastructure.progress_repository import (
    TaskProgressRepository,
)
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    ProgressEvidenceResponse,
    TaskProgressResponse,
    TaskProgressUpdateResponse,
)
from app.modules.teams.infrastructure.workspace_enums import ResourceType
from app.modules.teams.infrastructure.workspace_models import DeliverableVersion
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError


@dataclass(frozen=True)
class UploadedEvidence:
    filename: str
    content_type: str
    content: bytes


@dataclass(frozen=True)
class ProgressEvidenceInput:
    """Las tres vías de aportar evidencia; debe venir exactamente una."""

    upload: UploadedEvidence | None = None
    file_id: UUID | None = None
    deliverable_version_id: UUID | None = None
    # Solo con `upload`: además de vincular el archivo a la tarea, súmalo como
    # versión al entregable que la tarea ya tiene (sin cerrar ni entregar nada).
    attach_to_deliverable: bool = False

    def provided(self) -> int:
        return sum(
            x is not None
            for x in (self.upload, self.file_id, self.deliverable_version_id)
        )


def _file_label(file: ProjectFile) -> str:
    return file.name


def _version_label(version: DeliverableVersion, title: str | None, file_name) -> str:
    kind = file_name or (
        "enlace" if version.resource_type != ResourceType.ARCHIVO else "archivo"
    )
    base = (
        f"V{version.version_number} · {title}"
        if title
        else f"V{version.version_number}"
    )
    return f"{base} ({kind})"


class _ProgressSupport:
    """Piezas comunes a leer y a editar el avance."""

    def __init__(
        self, task_repo: TaskRepository, progress_repo: TaskProgressRepository
    ):
        self.task_repo = task_repo
        self.progress_repo = progress_repo

    async def _live_task(self, task_id: UUID) -> Task:
        task = await self.task_repo.get_by_id(task_id)
        if task is None or task.is_deleted:
            raise NotFoundError("La tarea no existe")
        return task

    async def _has_subtasks(self, task: Task) -> bool:
        return bool(await self.task_repo.get_subtasks(task.id))

    @staticmethod
    def _current_pct(task: Task) -> int:
        return compute_task_progress(
            task.status,
            task.requires_approval,
            manual_pct=task.manual_progress_pct,
        )


class GetTaskProgressUseCase(_ProgressSupport):
    """El avance de una tarea con su bitácora y la evidencia reutilizable."""

    async def execute(self, task_id: UUID, viewer_id: UUID) -> TaskProgressResponse:
        task = await self._live_task(task_id)
        has_subtasks = await self._has_subtasks(task)
        block = rules.progress_edit_block_reason(task.status, has_subtasks)
        is_owner = task.assignee_id == viewer_id

        deliverable = await self.progress_repo.get_deliverable_by_task(task.id)
        updates = await self.progress_repo.list_updates(task.id)
        evidence = await self._resolve_evidence(updates)

        # Con subtareas, el avance real es el promedio: la cifra que se muestra
        # la calcula `TaskService`; aquí solo se informa el declarado propio.
        return TaskProgressResponse(
            task_id=task.id,
            project_id=task.project_id,
            progress_pct=self._current_pct(task),
            manual_progress_pct=task.manual_progress_pct,
            can_edit=is_owner and block is None,
            locked_reason=None if block is None else block,
            has_deliverable=deliverable is not None,
            updates=[
                TaskProgressUpdateResponse(
                    id=u.id,
                    previous_pct=u.previous_pct,
                    new_pct=u.new_pct,
                    note=u.note,
                    author_id=u.author_id,
                    author_name=(
                        f"{u.author.name} {u.author.last_name}".strip()
                        if u.author is not None
                        else "Usuario eliminado"
                    ),
                    created_at=u.created_at,
                    evidence=evidence.get(u.id),
                )
                for u in updates
            ],
            evidence_options=await self._options(task, deliverable),
        )

    async def _resolve_evidence(
        self, updates: list[TaskProgressUpdate]
    ) -> dict[UUID, ProgressEvidenceResponse]:
        files = await self.progress_repo.files_by_ids(
            [u.file_id for u in updates if u.file_id]
        )
        versions = await self.progress_repo.versions_by_ids(
            [u.deliverable_version_id for u in updates if u.deliverable_version_id]
        )
        titles = await self.progress_repo.deliverable_titles(
            list({v.deliverable_id for v in versions.values()})
        )
        out: dict[UUID, ProgressEvidenceResponse] = {}
        for u in updates:
            version = (
                versions.get(u.deliverable_version_id)
                if u.deliverable_version_id
                else None
            )
            file = files.get(u.file_id) if u.file_id else None
            if version is not None:
                out[u.id] = self._version_evidence(
                    version, titles.get(version.deliverable_id), file
                )
            elif file is not None and not file.is_deleted:
                out[u.id] = self._file_evidence(file)
        return out

    @staticmethod
    def _file_evidence(file: ProjectFile) -> ProgressEvidenceResponse:
        return ProgressEvidenceResponse(
            kind="file",
            ref_id=file.id,
            file_id=file.id,
            label=_file_label(file),
            content_type=file.content_type,
            created_at=file.created_at,
        )

    @staticmethod
    def _version_evidence(
        version: DeliverableVersion, title: str | None, file: ProjectFile | None
    ) -> ProgressEvidenceResponse:
        return ProgressEvidenceResponse(
            kind="deliverable_version",
            ref_id=version.id,
            file_id=version.file_id,
            label=_version_label(version, title, file.name if file else None),
            content_type=file.content_type if file else None,
            created_at=version.created_at,
        )

    async def _options(self, task: Task, deliverable) -> list[ProgressEvidenceResponse]:
        """Evidencia ya vinculada a la tarea: sus versiones y los archivos
        sueltos (los que no son ya el adjunto de una versión, para no duplicar)."""
        options: list[ProgressEvidenceResponse] = []
        version_file_ids: set[UUID] = set()
        if deliverable is not None:
            files = await self.progress_repo.files_by_ids(
                [v.file_id for v in deliverable.versions if v.file_id]
            )
            for v in reversed(deliverable.versions):
                if v.file_id:
                    version_file_ids.add(v.file_id)
                options.append(
                    self._version_evidence(
                        v,
                        deliverable.task_title,
                        files.get(v.file_id) if v.file_id else None,
                    )
                )
        for f in await self.progress_repo.files_of_task(task.id):
            if f.id not in version_file_ids:
                options.append(self._file_evidence(f))
        return options


class RegisterTaskProgressUseCase(_ProgressSupport):
    """Edita el avance de una tarea propia, exigiendo evidencia."""

    def __init__(
        self,
        task_repo: TaskRepository,
        progress_repo: TaskProgressRepository,
        files: ProjectFilesService,
    ):
        super().__init__(task_repo, progress_repo)
        self._files = files

    async def execute(
        self,
        task_id: UUID,
        current_user,
        progress_pct: int,
        note: str | None,
        evidence: ProgressEvidenceInput,
    ) -> TaskProgressUpdate:
        task = await self._live_task(task_id)
        if task.assignee_id != current_user.id:
            raise ForbiddenError(
                "Solo el responsable de la tarea puede editar su avance"
            )

        block = rules.progress_edit_block_reason(
            task.status, await self._has_subtasks(task)
        )
        if block is not None:
            raise ValidationError(block)

        if not 0 <= progress_pct <= rules.MANUAL_PROGRESS_MAX:
            raise ValidationError(
                f"El avance va de 0 a {rules.MANUAL_PROGRESS_MAX}%: el 100% se "
                "alcanza al entregar la tarea."
            )
        previous = self._current_pct(task)
        if progress_pct == previous:
            raise ValidationError(f"La tarea ya está en {previous}%")

        if evidence.provided() != 1:
            raise ValidationError(
                "Respalda el avance con exactamente una evidencia: sube un "
                "archivo o elige una ya vinculada a la tarea."
            )

        file_id, version_id = await self._resolve(task, current_user, evidence)

        update = await self.progress_repo.add_update(
            TaskProgressUpdate(
                task_id=task.id,
                author_id=current_user.id,
                previous_pct=previous,
                new_pct=progress_pct,
                note=(note or "").strip() or None,
                file_id=file_id,
                deliverable_version_id=version_id,
            )
        )
        task.manual_progress_pct = progress_pct
        await self.task_repo.save(task)
        return update

    async def _resolve(
        self, task: Task, current_user, evidence: ProgressEvidenceInput
    ) -> tuple[UUID | None, UUID | None]:
        """Devuelve `(file_id, deliverable_version_id)` de la evidencia válida."""
        if evidence.upload is not None:
            return await self._store_upload(task, current_user, evidence)

        if evidence.file_id is not None:
            file = await self.progress_repo.get_file(evidence.file_id)
            if file is None or file.task_id != task.id:
                raise ValidationError("Ese archivo no está vinculado a esta tarea")
            return file.id, None

        version = await self.progress_repo.get_version(evidence.deliverable_version_id)  # type: ignore[arg-type]
        deliverable = await self.progress_repo.get_deliverable_by_task(task.id)
        if (
            version is None
            or deliverable is None
            or version.deliverable_id != deliverable.id
        ):
            raise ValidationError(
                "Esa versión no pertenece al entregable de esta tarea"
            )
        return version.file_id, version.id

    async def _store_upload(
        self, task: Task, current_user, evidence: ProgressEvidenceInput
    ) -> tuple[UUID | None, UUID | None]:
        upload = evidence.upload
        assert upload is not None
        # El archivo cae donde caería una entrega de esta tarea: la carpeta de su
        # equipo o, si es individual, la de la persona. Vinculado a la tarea.
        if task.team_id is not None:
            stored = await self._files.store_team_file(
                task.project_id,
                task.team_id,
                await self.task_repo.team_label(task.team_id),
                filename=upload.filename,
                content_type=upload.content_type,
                content=upload.content,
                uploader_id=current_user.id,
                task_id=task.id,
            )
        else:
            stored = await self._files.store_personal_file(
                task.project_id,
                current_user.id,
                f"{current_user.name} {current_user.last_name}".strip() or "Sin nombre",
                filename=upload.filename,
                content_type=upload.content_type,
                content=upload.content,
                task_id=task.id,
            )

        version_id: UUID | None = None
        if evidence.attach_to_deliverable:
            deliverable = await self.progress_repo.get_deliverable_by_task(task.id)
            if deliverable is None:
                raise ValidationError("La tarea aún no tiene un entregable")
            if deliverable.assignee_id != current_user.id:
                raise ForbiddenError("Este entregable no es tuyo")
            # Se suma como versión SIN tocar el estado del entregable ni el de la
            # tarea: es material de apoyo, no una entrega.
            next_number = (
                deliverable.versions[-1].version_number + 1
                if deliverable.versions
                else 1
            )
            version = await self.progress_repo.add_version(
                DeliverableVersion(
                    deliverable_id=deliverable.id,
                    version_number=next_number,
                    resource_type=ResourceType.ARCHIVO,
                    file_id=stored.id,
                    uploaded_by=current_user.id,
                )
            )
            version_id = version.id
        return stored.id, version_id
