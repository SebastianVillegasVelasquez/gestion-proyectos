"""Entregables PERSONALES: la vía para que quien tiene una tarea individual
(asignada a una persona, sin equipo) también pueda entregar y —si la tarea lo
exige— pasar por revisión.

Reutiliza el modelo `Deliverable` con `team_id IS NULL`; el dueño es
`assignee_id`. La autorización es distinta de la del equipo:

- entregar / editar / borrar: solo el dueño;
- revisar (aprobar, pedir cambios, rechazar): un responsable del PROYECTO de la
  tarea (coordinador o supervisor) o un rol de sistema elevado. El dueño nunca
  se autoaprueba;
- el "toggle de revisión" es `Task.requires_approval`, que el dueño fija desde
  esta misma pantalla.
"""

from uuid import UUID

from app.modules.files.application.use_cases import ProjectFilesService
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.teams.application._task_sync import cascade_after_completion
from app.modules.teams.domain.workspace import WorkspaceRepository
from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
    ResourceType,
)
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreatePersonalDeliverableRequest,
    PersonalDeliverableResponse,
    UpdateVersionRequest,
)
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError

_STATUS_BY_COMMENT = {
    CommentType.APROBACION: DeliverableStatus.APROBADO,
    CommentType.SOLICITUD_CAMBIO: DeliverableStatus.CAMBIOS_SOLICITADOS,
    CommentType.RECHAZO: DeliverableStatus.RECHAZADO,
}
_TASK_STATUS_ON_APPROVE = TaskStatus.COMPLETADA
_TASK_STATUS_ON_REJECT = TaskStatus.DEVUELTA
_TASK_STATUS_ON_DELIVER = TaskStatus.EN_REVISION

# Roles de sistema que pueden revisar cualquier entregable.
_ELEVATED_SYSTEM_ROLES = {"admin", "super_admin", "developer"}
# Roles de proyecto que revisan las entregas de sus miembros.
_PROJECT_REVIEW_ROLES = {"coordinador", "supervisor"}
# Estados de tarea que hacen que un entregable personal esté "por revisar".
_REVIEW_QUEUE_TASK_STATUSES = [TaskStatus.EN_REVISION]


class PersonalDeliverableService:
    def __init__(
        self,
        repo: WorkspaceRepository,
        bus=None,
        files: ProjectFilesService | None = None,
        notifier=None,
    ):
        self._repo = repo
        self._bus = bus
        self._files = files
        # Colaborador opcional: avisa al dueño del entregable cuando su
        # revisor decide (aprobar / pedir cambios / rechazar).
        self._notifier = notifier

    async def _cascade_if_completed(self, task) -> None:
        """Tras dejar una tarea en COMPLETADA por una entrega/aprobación,
        dispara la cascada de fechas FtS (no pasa por ChangeTaskStatusUseCase)."""
        await cascade_after_completion(
            getattr(self._repo, "_session", None), self._bus, task, None
        )

    # ── helpers ─────────────────────────────────────────────────────────────
    async def _is_reviewer_of_task(self, current_user, task) -> bool:
        if task is None:
            return False
        if current_user.role.value in _ELEVATED_SYSTEM_ROLES:
            return True
        role = await self._repo.get_project_review_role(
            task.project_id, current_user.id
        )
        return role in _PROJECT_REVIEW_ROLES

    async def _view(
        self, deliverable: Deliverable | None, current_user
    ) -> PersonalDeliverableResponse:
        if deliverable is None:
            raise NotFoundError("Entregable no encontrado")
        task = (
            await self._repo.get_task(deliverable.task_id)
            if deliverable.task_id
            else None
        )
        project_id = task.project_id if task is not None else None
        project_name = (
            await self._repo.get_project_name(project_id)
            if project_id is not None
            else None
        )
        return PersonalDeliverableResponse.of_personal(
            deliverable,
            project_id=project_id,
            project_name=project_name,
            task_requires_approval=(
                task.requires_approval if task is not None else None
            ),
            viewer_is_owner=deliverable.assignee_id == current_user.id,
            viewer_can_review=await self._is_reviewer_of_task(current_user, task),
        )

    async def _require_own(self, deliverable_id: UUID, current_user) -> Deliverable:
        deliverable = await self._repo.get_personal_deliverable(deliverable_id)
        if deliverable is None:
            raise NotFoundError("Entregable no encontrado")
        if deliverable.assignee_id != current_user.id:
            raise ForbiddenError("Este entregable no es tuyo")
        return deliverable

    # ── lectura ────────────────────────────────────────────────────────────
    async def list_mine(self, current_user) -> list[PersonalDeliverableResponse]:
        items = await self._repo.list_personal_deliverables(current_user.id)
        return [await self._view(d, current_user) for d in items]

    async def list_review_queue(
        self, current_user
    ) -> list[PersonalDeliverableResponse]:
        rows = await self._repo.list_personal_review_queue(
            current_user.id, _REVIEW_QUEUE_TASK_STATUSES
        )
        out: list[PersonalDeliverableResponse] = []
        for deliverable, project_id, project_name in rows:
            task = (
                await self._repo.get_task(deliverable.task_id)
                if deliverable.task_id
                else None
            )
            out.append(
                PersonalDeliverableResponse.of_personal(
                    deliverable,
                    project_id=project_id,
                    project_name=project_name,
                    task_requires_approval=(
                        task.requires_approval if task is not None else None
                    ),
                    viewer_is_owner=False,
                    viewer_can_review=True,
                )
            )
        return out

    # ── escritura del dueño ────────────────────────────────────────────────
    async def create(
        self, data: CreatePersonalDeliverableRequest, current_user
    ) -> PersonalDeliverableResponse:
        task = None
        if data.task_id is not None:
            task = await self._repo.get_task(data.task_id)
            if task is None:
                raise NotFoundError("La tarea vinculada no existe")
            if task.assignee_id != current_user.id:
                raise ForbiddenError("Solo puedes entregar tareas que tienes asignadas")
            if task.team_id is not None:
                raise ValidationError(
                    "Esa tarea es de un equipo: se entrega desde el espacio del equipo"
                )
            existing = await self._repo.get_deliverable_by_task(data.task_id)
            if existing is not None:
                raise ValidationError(
                    "Esta tarea ya tiene un entregable — súbele una nueva versión"
                )
            if data.requires_approval is not None:
                task.requires_approval = data.requires_approval
                await self._repo.save_task(task)

        created = await self._repo.add_deliverable(
            Deliverable(
                team_id=None,
                task_title=data.task_title,
                assignee_id=current_user.id,
                task_id=data.task_id,
                status=DeliverableStatus.BORRADOR,
            )
        )
        return await self._view(
            await self._repo.get_personal_deliverable(created.id), current_user
        )

    async def set_approval(
        self, deliverable_id: UUID, requires_approval: bool, current_user
    ) -> PersonalDeliverableResponse:
        deliverable = await self._require_own(deliverable_id, current_user)
        if deliverable.task_id is None:
            raise ValidationError(
                "Este entregable no está vinculado a una tarea del proyecto"
            )
        task = await self._repo.get_task(deliverable.task_id)
        if task is None:
            raise NotFoundError("La tarea vinculada no existe")
        task.requires_approval = requires_approval
        await self._repo.save_task(task)
        return await self._view(deliverable, current_user)

    async def _open_delivery(self, deliverable_id: UUID, current_user):
        """Comprueba que esta persona puede entregar ESTE entregable AHORA.

        Devuelve el entregable y su tarea vinculada (si la hay). Se hace antes
        de escribir nada —igual da URL que archivo— para no dejar rastro a
        medias de una entrega que el servidor va a rechazar.
        """
        deliverable = await self._require_own(deliverable_id, current_user)

        # Compuerta FtS también en "Mis tareas": entregar salta
        # ChangeTaskStatusUseCase, así que si la tarea depende de algo (otra
        # tarea o una actividad de terceros) que aún no está listo, no deja
        # entregar.
        task = (
            await self._repo.get_task(deliverable.task_id)
            if deliverable.task_id
            else None
        )
        if task is not None:
            blocked = await self._repo.task_delivery_block_reason(task)
            if blocked:
                raise ValidationError(blocked)
        return deliverable, task

    @staticmethod
    def _next_version_number(deliverable: Deliverable) -> int:
        return (
            deliverable.versions[-1].version_number + 1 if deliverable.versions else 1
        )

    async def add_version(
        self, deliverable_id: UUID, data: AddVersionRequest, current_user
    ) -> PersonalDeliverableResponse:
        deliverable, task = await self._open_delivery(deliverable_id, current_user)
        await self._repo.add_version(
            DeliverableVersion(
                deliverable_id=deliverable.id,
                version_number=self._next_version_number(deliverable),
                resource_type=data.type,
                url=data.url,
                note=data.note,
                observations=data.observations,
                uploaded_by=current_user.id,
            )
        )
        return await self._close_delivery(deliverable, task, current_user)

    async def add_file_version(
        self,
        deliverable_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
        note: str | None,
        observations: str | None,
        current_user,
    ) -> PersonalDeliverableResponse:
        """Entrega un ARCHIVO en una tarea individual.

        Va a la carpeta de la persona dentro del archivador del proyecto —el
        equivalente sin equipo de la carpeta de equipo—, así el material
        entregado vive donde vive el resto del material del proyecto y no en un
        enlace externo que mañana puede no existir.
        """
        if self._files is None:
            raise ValidationError("La subida de archivos no está disponible")
        deliverable, task = await self._open_delivery(deliverable_id, current_user)
        if task is None:
            # Sin tarea no hay proyecto, y sin proyecto no hay archivador donde
            # dejar el archivo. Una entrega suelta sigue admitiendo una URL.
            raise ValidationError(
                "Vincula la entrega a una tarea del proyecto para adjuntar archivos"
            )

        stored = await self._files.store_personal_file(
            task.project_id,
            current_user.id,
            f"{current_user.name} {current_user.last_name}".strip() or "Sin nombre",
            filename=filename,
            content_type=content_type,
            content=content,
        )
        await self._repo.add_version(
            DeliverableVersion(
                deliverable_id=deliverable.id,
                version_number=self._next_version_number(deliverable),
                resource_type=ResourceType.ARCHIVO,
                file_id=stored.id,
                note=note,
                observations=observations,
                uploaded_by=current_user.id,
            )
        )
        return await self._close_delivery(deliverable, task, current_user)

    async def _close_delivery(
        self, deliverable: Deliverable, task, current_user
    ) -> PersonalDeliverableResponse:
        """Lo que pasa DESPUÉS de registrar una entrega, sea URL o archivo:
        mover el estado del entregable y el de la tarea. Es idéntico en los dos
        caminos, así que vive una sola vez."""
        auto_complete = task is not None and not task.requires_approval
        deliverable.status = (
            DeliverableStatus.APROBADO
            if auto_complete
            else DeliverableStatus.EN_REVISION
        )
        await self._repo.save_deliverable(deliverable)

        if task is not None:
            was_completed = task.status == TaskStatus.COMPLETADA
            await self._repo.transition_task(
                task,
                _TASK_STATUS_ON_APPROVE if auto_complete else _TASK_STATUS_ON_DELIVER,
                current_user.id,
                (
                    "Entrega directa: la tarea no requiere aprobación"
                    if auto_complete
                    else None
                ),
            )
            if not was_completed:
                await self._cascade_if_completed(task)
        return await self._view(
            await self._repo.get_personal_deliverable(deliverable.id), current_user
        )

    async def update_version(
        self,
        deliverable_id: UUID,
        version_id: UUID,
        data: UpdateVersionRequest,
        current_user,
    ) -> PersonalDeliverableResponse:
        deliverable = await self._require_own(deliverable_id, current_user)
        version = next((v for v in deliverable.versions if v.id == version_id), None)
        if version is None:
            raise NotFoundError("La versión no existe")
        if data.type is not None:
            version.resource_type = data.type
        if data.url is not None:
            version.url = data.url
        if data.note is not None:
            version.note = data.note or None
        if data.observations is not None:
            version.observations = data.observations or None
        await self._repo.save_deliverable(deliverable)
        return await self._view(
            await self._repo.get_personal_deliverable(deliverable_id), current_user
        )

    async def delete(self, deliverable_id: UUID, current_user) -> None:
        deliverable = await self._require_own(deliverable_id, current_user)
        if deliverable.status == DeliverableStatus.APROBADO:
            raise ValidationError("No puedes eliminar un entregable ya aprobado")
        deliverable.soft_delete()
        await self._repo.save_deliverable(deliverable)

    # ── comentarios / revisión ────────────────────────────────────────────
    async def add_comment(
        self, deliverable_id: UUID, data: AddCommentRequest, current_user
    ) -> PersonalDeliverableResponse:
        deliverable = await self._repo.get_personal_deliverable(deliverable_id)
        if deliverable is None:
            raise NotFoundError("Entregable no encontrado")

        task = (
            await self._repo.get_task(deliverable.task_id)
            if deliverable.task_id
            else None
        )
        is_owner = deliverable.assignee_id == current_user.id
        is_reviewer = await self._is_reviewer_of_task(current_user, task)
        is_review = data.type in _STATUS_BY_COMMENT

        if is_review and not is_reviewer:
            raise ForbiddenError(
                "Solo un responsable del proyecto puede aprobar, pedir cambios o rechazar"
            )
        if not is_review and not (is_owner or is_reviewer):
            raise ForbiddenError("No tienes acceso a este entregable")

        await self._repo.add_comment(
            DeliverableComment(
                deliverable_id=deliverable.id,
                author_id=current_user.id,
                content=data.content,
                comment_type=data.type,
                mentions=[str(m) for m in data.mentions],
            )
        )

        new_status = _STATUS_BY_COMMENT.get(data.type)
        if new_status is not None:
            deliverable.status = new_status
            await self._repo.save_deliverable(deliverable)
            if task is not None:
                if data.type == CommentType.APROBACION:
                    was_completed = task.status == TaskStatus.COMPLETADA
                    await self._repo.transition_task(
                        task, _TASK_STATUS_ON_APPROVE, current_user.id
                    )
                    if not was_completed:
                        await self._cascade_if_completed(task)
                else:
                    await self._repo.transition_task(
                        task,
                        _TASK_STATUS_ON_REJECT,
                        current_user.id,
                        data.content,
                    )

            if self._notifier is not None:
                await self._notifier.review_decided(
                    owner_id=deliverable.assignee_id,
                    reviewer_id=current_user.id,
                    decision=data.type,
                    team_id=None,
                    deliverable_id=deliverable.id,
                    task_id=deliverable.task_id,
                )

        return await self._view(
            await self._repo.get_personal_deliverable(deliverable_id), current_user
        )
