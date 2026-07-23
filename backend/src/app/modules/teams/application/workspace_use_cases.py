from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.teams.domain.workspace import WorkspaceAccess, WorkspaceRepository
from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
)
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreateDeliverableRequest,
    DeliverableResponse,
    MyTeamResponse,
    WorkspaceAccessResponse,
)
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError

# Una solicitud de cambio o una aprobación mueve el estado del entregable.
_STATUS_BY_COMMENT = {
    CommentType.APROBACION: DeliverableStatus.APROBADO,
    CommentType.SOLICITUD_CAMBIO: DeliverableStatus.CAMBIOS_SOLICITADOS,
}

# Fase 2: cómo el estado de la Task vinculada acompaña al del entregable. Una
# entrega mueve la tarea a EN_REVISION; aprobar la marca COMPLETADA; rechazar
# la deja DEVUELTA (para que el integrante la retome).
_TASK_STATUS_ON_APPROVE = TaskStatus.COMPLETADA
_TASK_STATUS_ON_REJECT = TaskStatus.DEVUELTA
_TASK_STATUS_ON_DELIVER = TaskStatus.EN_REVISION


class WorkspaceService:
    """Casos de uso del espacio de trabajo. Exige la política antes de actuar."""

    def __init__(self, repo: WorkspaceRepository):
        self._repo = repo

    # ── acceso ───────────────────────────────────────────────────────────────
    async def _access(self, team_id: UUID, current_user) -> WorkspaceAccess:
        role = await self._repo.get_member_role(team_id, current_user.id)
        return WorkspaceAccess.resolve(current_user.role.value, role)

    async def list_my_teams(self, current_user) -> list[MyTeamResponse]:
        teams = await self._repo.list_member_teams(current_user.id)
        return [
            MyTeamResponse(id=t.id, name=t.name, description=t.description)
            for t in teams
        ]

    async def access(self, team_id: UUID, current_user) -> WorkspaceAccessResponse:
        a = await self._access(team_id, current_user)
        return WorkspaceAccessResponse(
            team_role=a.team_role,
            can_view=a.can_view,
            can_deliver=a.can_deliver,
            can_review=a.can_review,
        )

    async def _require_deliverable(
        self, team_id: UUID, deliverable_id: UUID
    ) -> Deliverable:
        deliverable = await self._repo.get_deliverable(team_id, deliverable_id)
        if deliverable is None:
            raise NotFoundError("Entregable no encontrado")
        return deliverable

    # ── lectura (privacidad: admin o integrante del equipo) ──────────────────
    async def list_deliverables(
        self, team_id: UUID, current_user
    ) -> list[DeliverableResponse]:
        if not (await self._access(team_id, current_user)).can_view:
            raise ForbiddenError("No tienes acceso al espacio de este equipo")
        items = await self._repo.list_deliverables(team_id)
        return [DeliverableResponse.of(d) for d in items]

    async def get_deliverable(
        self, team_id: UUID, deliverable_id: UUID, current_user
    ) -> DeliverableResponse:
        if not (await self._access(team_id, current_user)).can_view:
            raise ForbiddenError("No tienes acceso al espacio de este equipo")
        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )

    # ── escritura (solo integrantes; revisión solo líder/supervisor) ─────────
    async def create_deliverable(
        self, team_id: UUID, data: CreateDeliverableRequest, current_user
    ) -> DeliverableResponse:
        if not (await self._access(team_id, current_user)).can_deliver:
            raise ForbiddenError(
                "Solo los integrantes del equipo pueden crear entregables"
            )

        # Fase 2: si viene `task_id`, la Task debe existir y estar delegada a
        # este equipo. Así el entregable no puede "colarse" en tareas de otro
        # equipo o inexistentes.
        if data.task_id is not None:
            task = await self._repo.get_task(data.task_id)
            if task is None:
                raise NotFoundError("La tarea vinculada no existe")
            if task.team_id != team_id:
                raise ValidationError("La tarea no está delegada a este equipo")

        created = await self._repo.add_deliverable(
            Deliverable(
                team_id=team_id,
                task_title=data.task_title,
                assignee_id=data.assignee_id,
                task_id=data.task_id,
                status=DeliverableStatus.BORRADOR,
            )
        )
        return DeliverableResponse.of(
            await self._require_deliverable(team_id, created.id)
        )

    async def add_version(
        self, team_id: UUID, deliverable_id: UUID, data: AddVersionRequest, current_user
    ) -> DeliverableResponse:
        if not (await self._access(team_id, current_user)).can_deliver:
            raise ForbiddenError("Solo los integrantes del equipo pueden entregar")
        deliverable = await self._require_deliverable(team_id, deliverable_id)
        next_number = (
            deliverable.versions[-1].version_number + 1 if deliverable.versions else 1
        )
        await self._repo.add_version(
            DeliverableVersion(
                deliverable_id=deliverable.id,
                version_number=next_number,
                resource_type=data.type,
                url=data.url,
                note=data.note,
                uploaded_by=current_user.id,
            )
        )
        deliverable.status = DeliverableStatus.EN_REVISION
        await self._repo.save_deliverable(deliverable)

        # Fase 2: si el entregable está vinculado a una Task, entregar mueve la
        # tarea a "en revisión" y deja rastro en TaskHistory. Idempotente.
        await self._sync_task_status(deliverable, _TASK_STATUS_ON_DELIVER, current_user)

        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )

    async def add_comment(
        self, team_id: UUID, deliverable_id: UUID, data: AddCommentRequest, current_user
    ) -> DeliverableResponse:
        access = await self._access(team_id, current_user)
        is_review = data.type in _STATUS_BY_COMMENT
        if is_review and not access.can_review:
            raise ForbiddenError(
                "Solo el líder o supervisor puede solicitar cambios o aprobar"
            )
        if not is_review and not access.can_comment:
            raise ForbiddenError("No tienes acceso al espacio de este equipo")
        deliverable = await self._require_deliverable(team_id, deliverable_id)
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

            # Fase 2: la revisión mueve la Task vinculada. El motivo del
            # rechazo viaja al historial (los jefes leen el porqué en Trazabilidad).
            if data.type == CommentType.APROBACION:
                await self._sync_task_status(
                    deliverable, _TASK_STATUS_ON_APPROVE, current_user
                )
            elif data.type == CommentType.SOLICITUD_CAMBIO:
                await self._sync_task_status(
                    deliverable,
                    _TASK_STATUS_ON_REJECT,
                    current_user,
                    reason=data.content,
                )

        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )

    # ── Sincronía Deliverable → Task (Fase 2) ────────────────────────────────
    async def _sync_task_status(
        self,
        deliverable: Deliverable,
        new_status: TaskStatus,
        actor,
        reason: str | None = None,
    ) -> None:
        """Refleja el cambio de revisión en la Task vinculada, si existe.

        Silencioso cuando no hay vínculo o la tarea fue borrada: la Fase 2 es
        aditiva y el flujo antiguo (entregables sueltos) sigue funcionando.
        """
        if deliverable.task_id is None:
            return
        task = await self._repo.get_task(deliverable.task_id)
        if task is None:
            return
        await self._repo.transition_task(task, new_status, actor.id, reason)
