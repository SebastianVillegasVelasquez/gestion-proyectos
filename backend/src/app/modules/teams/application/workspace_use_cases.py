from uuid import UUID

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
    WorkspaceAccessResponse,
)
from app.shared.exceptions import ForbiddenError, NotFoundError

# Una solicitud de cambio o una aprobación mueve el estado del entregable.
_STATUS_BY_COMMENT = {
    CommentType.APROBACION: DeliverableStatus.APROBADO,
    CommentType.SOLICITUD_CAMBIO: DeliverableStatus.CAMBIOS_SOLICITADOS,
}


class WorkspaceService:
    """Casos de uso del espacio de trabajo. Exige la política antes de actuar."""

    def __init__(self, repo: WorkspaceRepository):
        self._repo = repo

    # ── acceso ───────────────────────────────────────────────────────────────
    async def _access(self, team_id: UUID, current_user) -> WorkspaceAccess:
        role = await self._repo.get_member_role(team_id, current_user.id)
        return WorkspaceAccess.resolve(current_user.role.value, role)

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
        created = await self._repo.add_deliverable(
            Deliverable(
                team_id=team_id,
                task_title=data.task_title,
                assignee_id=data.assignee_id,
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
        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )
