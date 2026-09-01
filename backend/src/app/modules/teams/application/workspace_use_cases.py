from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.teams.application._task_sync import cascade_after_completion
from app.modules.teams.domain.workspace import WorkspaceAccess, WorkspaceRepository
from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
)
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
    TeamNotificationSetting,
)
from app.modules.teams.presentation.schemas import TeamMemberResponse
from app.modules.teams.presentation.workspace_schemas import (
    AddCommentRequest,
    AddVersionRequest,
    CreateDeliverableRequest,
    DeliverableResponse,
    MyTeamResponse,
    TeamNotificationSettingsResponse,
    UpdateTeamNotificationSettingsRequest,
    UpdateVersionRequest,
    WorkspaceAccessResponse,
)
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError

# Una solicitud de cambio o una aprobación mueve el estado del entregable.
_STATUS_BY_COMMENT = {
    CommentType.APROBACION: DeliverableStatus.APROBADO,
    CommentType.SOLICITUD_CAMBIO: DeliverableStatus.CAMBIOS_SOLICITADOS,
    CommentType.RECHAZO: DeliverableStatus.RECHAZADO,
}

# Fase 2: cómo el estado de la Task vinculada acompaña al del entregable. Una
# entrega mueve la tarea a EN_REVISION; aprobar la marca COMPLETADA; rechazar
# la deja DEVUELTA (para que el integrante la retome).
_TASK_STATUS_ON_APPROVE = TaskStatus.COMPLETADA
_TASK_STATUS_ON_REJECT = TaskStatus.DEVUELTA
_TASK_STATUS_ON_DELIVER = TaskStatus.EN_REVISION


class WorkspaceService:
    """Casos de uso del espacio de trabajo. Exige la política antes de actuar."""

    def __init__(self, repo: WorkspaceRepository, notifier=None, bus=None):
        self._repo = repo
        # Colaborador opcional: avisa a líder/supervisor cuando se entrega.
        # Solo la ruta de "subir versión" lo inyecta; el resto crea el
        # servicio sin él y nada cambia.
        self._notifier = notifier
        # Bus opcional para publicar TaskChainRescheduled tras una cascada.
        self._bus = bus

    async def _cascade_if_completed(self, task) -> None:
        """Tras dejar una tarea en COMPLETADA por una entrega/aprobación,
        dispara la cascada de fechas FtS (no pasa por ChangeTaskStatusUseCase)."""
        await cascade_after_completion(
            getattr(self._repo, "_session", None), self._bus, task, None
        )

    # ── acceso ───────────────────────────────────────────────────────────────
    async def _access(self, team_id: UUID, current_user) -> WorkspaceAccess:
        role = await self._repo.get_member_role(team_id, current_user.id)
        return WorkspaceAccess.resolve(current_user.role.value, role)

    async def list_my_teams(self, current_user) -> list[MyTeamResponse]:
        teams = await self._repo.list_member_teams(current_user.id)
        return [
            MyTeamResponse(
                id=t.id,
                name=t.name,
                description=t.description,
                project_id=t.project_id,
            )
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
    async def list_members(
        self, team_id: UUID, current_user
    ) -> list[TeamMemberResponse]:
        if not (await self._access(team_id, current_user)).can_view:
            raise ForbiddenError("No tienes acceso al espacio de este equipo")
        members = await self._repo.list_members(team_id)
        return [
            TeamMemberResponse(
                user_id=m.user_id,
                name=m.user.name,
                last_name=m.user.last_name,
                position=m.user.position,
                team_role=m.team_role,
            )
            for m in members
        ]

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

        # Cada quien entrega SU trabajo, nunca "a nombre de" otro integrante:
        # sin esto, cualquiera del equipo podía crear un entregable con el
        # `assignee_id` de otra persona.
        if data.assignee_id != current_user.id:
            raise ForbiddenError("Solo puedes crear entregables asignados a ti mismo")

        # Fase 2: si viene `task_id`, la Task debe existir, estar delegada a
        # este equipo y estar asignada A QUIEN entrega — no basta con que sea
        # del equipo: solo el responsable de la tarea puede entregarla.
        if data.task_id is not None:
            task = await self._repo.get_task(data.task_id)
            if task is None:
                raise NotFoundError("La tarea vinculada no existe")
            if task.team_id != team_id:
                raise ValidationError("La tarea no está delegada a este equipo")
            if task.assignee_id != current_user.id:
                raise ForbiddenError("Solo puedes entregar tareas que tienes asignadas")
            existing = await self._repo.get_deliverable_by_task(data.task_id)
            if existing is not None:
                raise ValidationError(
                    "Esta tarea ya tiene un entregable — súbele una nueva versión en vez de crear otro"
                )

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
        if deliverable.assignee_id != current_user.id:
            raise ForbiddenError(
                "Solo quien tiene asignado el entregable puede entregar"
            )

        # Compuerta FtS: entregar mueve el estado de la tarea sin pasar por
        # ChangeTaskStatusUseCase, así que revisamos aquí que la tarea no
        # dependa de algo (otra tarea, o una actividad de terceros) que aún no
        # está listo. Antes de crear la versión, para no dejar rastro a medias.
        task = (
            await self._repo.get_task(deliverable.task_id)
            if deliverable.task_id
            else None
        )
        if task is not None:
            blocked = await self._repo.task_delivery_block_reason(task)
            if blocked:
                raise ValidationError(blocked)

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
                observations=data.observations,
                uploaded_by=current_user.id,
            )
        )

        # La tarea vinculada (si hay) decide si esto necesita revisión:
        # `requires_approval=False` (el default) — entregar completa directo,
        # sin pasar por el líder. `True` — mantiene el flujo clásico
        # (EN_REVISION → el líder aprueba o devuelve).
        auto_complete = task is not None and not task.requires_approval

        deliverable.status = (
            DeliverableStatus.APROBADO
            if auto_complete
            else DeliverableStatus.EN_REVISION
        )
        await self._repo.save_deliverable(deliverable)

        if auto_complete and task is not None:
            # Fase 2 + toggle: sin revisión obligatoria, entregar ES completar.
            was_completed = task.status == TaskStatus.COMPLETADA
            await self._repo.transition_task(
                task,
                _TASK_STATUS_ON_APPROVE,
                current_user.id,
                "Entrega directa: la tarea no requiere aprobación",
            )
            if not was_completed:
                await self._cascade_if_completed(task)
        else:
            # Fase 2: si el entregable está vinculado a una Task, entregar mueve
            # la tarea a "en revisión" y deja rastro en TaskHistory. Idempotente.
            await self._sync_task_status(
                deliverable, _TASK_STATUS_ON_DELIVER, current_user
            )

            # T8: avisar a quien revisa (líder / supervisor) que hay entrega
            # nueva. Si no hace falta revisión, nadie tiene que revisar nada.
            if self._notifier is not None:
                members = await self._repo.list_members(team_id)
                team = await self._repo.get_team(team_id)
                await self._notifier.deliverable_submitted(
                    team_id=team_id,
                    team_name=team.name if team else "",
                    project_name=team.name if team else "",
                    deliverable_id=deliverable.id,
                    task_id=deliverable.task_id,
                    task_title=deliverable.task_title,
                    submitter_id=current_user.id,
                    submitter_name=getattr(current_user, "name", "Un integrante"),
                    reviewers=members,
                )

        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )

    async def delete_deliverable(
        self, team_id: UUID, deliverable_id: UUID, current_user
    ) -> None:
        """Borra un entregable propio, mientras no esté ya aprobado.

        Una vez aprobado, ya movió el avance del proyecto — deshacerlo pasa
        primero por que el líder reabra la revisión (`add_comment`), no por
        borrar en silencio.
        """
        deliverable = await self._require_deliverable(team_id, deliverable_id)
        if deliverable.assignee_id != current_user.id:
            raise ForbiddenError("Solo quien entregó puede eliminar su entregable")
        if deliverable.status == DeliverableStatus.APROBADO:
            raise ValidationError("No puedes eliminar un entregable ya aprobado")
        deliverable.soft_delete()
        await self._repo.save_deliverable(deliverable)

    async def update_version(
        self,
        team_id: UUID,
        deliverable_id: UUID,
        version_id: UUID,
        data: UpdateVersionRequest,
        current_user,
    ) -> DeliverableResponse:
        """Corrige una entrega ya subida (URL, nota u observaciones). Solo cambia
        lo que se envía; no crea una versión nueva ni mueve el estado."""
        if not (await self._access(team_id, current_user)).can_deliver:
            raise ForbiddenError("Solo los integrantes del equipo pueden entregar")
        deliverable = await self._require_deliverable(team_id, deliverable_id)
        if deliverable.assignee_id != current_user.id:
            raise ForbiddenError("Solo quien entregó puede corregir su entrega")
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
            elif data.type in (CommentType.SOLICITUD_CAMBIO, CommentType.RECHAZO):
                # Ambos devuelven la tarea al integrante; el motivo del rechazo
                # viaja al historial (los jefes leen el porque en Trazabilidad).
                await self._sync_task_status(
                    deliverable,
                    _TASK_STATUS_ON_REJECT,
                    current_user,
                    reason=data.content,
                )

        return DeliverableResponse.of(
            await self._require_deliverable(team_id, deliverable_id)
        )

    # ── Preferencias de aviso (propias, dentro de este equipo) ───────────────
    async def get_notifications(
        self, team_id: UUID, current_user
    ) -> TeamNotificationSettingsResponse:
        """Sin fila guardada devuelve los valores por defecto (todo activado)."""
        if not (await self._access(team_id, current_user)).can_view:
            raise ForbiddenError("No tienes acceso al espacio de este equipo")
        row = await self._repo.get_notification_setting(team_id, current_user.id)
        if row is None:
            return TeamNotificationSettingsResponse()
        return TeamNotificationSettingsResponse(
            nueva_tarea_asignada=row.nueva_tarea_asignada,
            entregable_rechazado=row.entregable_rechazado,
            comentario_nuevo=row.comentario_nuevo,
            entregable_aprobado=row.entregable_aprobado,
        )

    async def update_notifications(
        self, team_id: UUID, data: UpdateTeamNotificationSettingsRequest, current_user
    ) -> TeamNotificationSettingsResponse:
        """Solo un integrante ajusta SUS avisos; el admin observador no tiene."""
        if not (await self._access(team_id, current_user)).is_member:
            raise ForbiddenError("Solo los integrantes del equipo ajustan sus avisos")
        row = await self._repo.get_notification_setting(team_id, current_user.id)
        if row is None:
            row = TeamNotificationSetting(team_id=team_id, user_id=current_user.id)
        row.nueva_tarea_asignada = data.nueva_tarea_asignada
        row.entregable_rechazado = data.entregable_rechazado
        row.comentario_nuevo = data.comentario_nuevo
        row.entregable_aprobado = data.entregable_aprobado
        saved = await self._repo.save_notification_setting(row)
        return TeamNotificationSettingsResponse(
            nueva_tarea_asignada=saved.nueva_tarea_asignada,
            entregable_rechazado=saved.entregable_rechazado,
            comentario_nuevo=saved.comentario_nuevo,
            entregable_aprobado=saved.entregable_aprobado,
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
        was_completed = task.status == TaskStatus.COMPLETADA
        await self._repo.transition_task(task, new_status, actor.id, reason)
        if not was_completed:
            await self._cascade_if_completed(task)
