"""Avisos al entregar y al revisar en el espacio de trabajo de un equipo.

Cuando un integrante sube una versión de un entregable (lo "entrega"), el
líder y el/los supervisor(es) del equipo reciben:

  * una notificación in-app (campanita + tiempo real), y
  * un correo con la marca OBJ, "hay una entrega para revisar".

Al revés —cuando quien revisa decide (aprobar, pedir cambios o rechazar)—
quien entregó recibe una notificación in-app distinta por cada decisión.

Se inyecta como colaborador OPCIONAL de ``WorkspaceService`` /
``PersonalDeliverableService``: solo las rutas que suben versiones o deciden
una revisión lo construyen; el resto de rutas siguen creando el servicio sin
él. Así el flujo antiguo (tests incluidos) no cambia.
"""

from __future__ import annotations

import json
from uuid import UUID

from app.core.logger import get_logger
from app.modules.notifications.application.preferences import TeamNotificationGate
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.workspace_enums import CommentType
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.email.sender import EmailSender
from app.shared.email.templates import deliverable_submitted_email

logger = get_logger(__name__)

_REVIEWER_ROLES = (TeamRole.LIDER, TeamRole.SUPERVISOR)

# Las tres decisiones de revisión (`ReviewActions` en el frontend) disparan
# cada una un tipo de aviso distinto para quien entregó.
_REVIEW_NOTIFICATION_TYPE = {
    CommentType.APROBACION: NotificationType.TAREA_COMPLETADA,
    CommentType.SOLICITUD_CAMBIO: NotificationType.TAREA_DEVUELTA,
    CommentType.RECHAZO: NotificationType.TAREA_RECHAZADA,
}
_REVIEW_MESSAGE = {
    CommentType.APROBACION: "Tu entrega fue aprobada y la tarea quedó completada.",
    CommentType.SOLICITUD_CAMBIO: (
        "Tu entrega fue devuelta con observaciones. Ajusta lo indicado y "
        "vuelve a enviarla."
    ),
    CommentType.RECHAZO: (
        "Tu entrega fue rechazada. Revisa el motivo en los comentarios y "
        "replantea el trabajo."
    ),
}
# Mismo toggle de «Configuración del equipo» que ya cubre ambas cosas
# («Rechazan o devuelven un entregable»): pedir cambios y rechazar comparten
# preferencia, aprobar tiene la suya propia.
_REVIEW_GATE_FIELD = {
    CommentType.APROBACION: "entregable_aprobado",
    CommentType.SOLICITUD_CAMBIO: "entregable_rechazado",
    CommentType.RECHAZO: "entregable_rechazado",
}


def _channel(user_id: UUID) -> str:
    return f"notifications:user:{user_id}"


class DeliverableNotifier:
    def __init__(
        self,
        *,
        session,
        broadcaster: Broadcaster,
        email_sender: EmailSender,
        public_url: str = "",
    ) -> None:
        self._session = session
        self._broadcaster = broadcaster
        self._email = email_sender
        self._public_url = public_url.rstrip("/")

    async def deliverable_submitted(
        self,
        *,
        team_id: UUID,
        team_name: str,
        project_name: str,
        deliverable_id: UUID,
        task_id: UUID | None,
        task_title: str,
        submitter_id: UUID,
        submitter_name: str,
        reviewers: list,  # TeamMember con .user cargado y .team_role
    ) -> None:
        review_url = f"{self._public_url}/workspace" if self._public_url else ""
        for member in reviewers:
            if member.team_role not in _REVIEWER_ROLES:
                continue
            if member.user_id == submitter_id:
                continue  # un líder que se autoentrega no se autoavisa

            self._session.add(
                Notification(
                    user_to_id=member.user_id,
                    actor_id=submitter_id,
                    notification_type=NotificationType.TAREA_ENTREGADA,
                    message=(
                        f"{submitter_name} entregó «{task_title}» y espera tu revisión."
                    ),
                    payload={
                        "team_id": str(team_id),
                        "deliverable_id": str(deliverable_id),
                        "task_id": str(task_id) if task_id else None,
                    },
                )
            )
            try:
                await self._broadcaster.publish(
                    channel=_channel(member.user_id),
                    message=json.dumps({"type": "notification.new"}),
                )
            except Exception:
                logger.exception(
                    "No se pudo publicar el aviso de entrega al usuario %s",
                    member.user_id,
                )

            user = getattr(member, "user", None)
            if user is None or not getattr(user, "email", None):
                continue
            mail = deliverable_submitted_email(
                leader_name=user.name,
                submitter_name=submitter_name,
                task_title=task_title,
                project_name=project_name or team_name,
                review_url=review_url,
            )
            try:
                await self._email.send(
                    to=user.email,
                    subject=mail.subject,
                    body=mail.text,
                    html=mail.html,
                )
            except Exception:
                logger.error(
                    "Fallo al enviar correo de entrega para revisión",
                    exc_info=True,
                )

    async def review_decided(
        self,
        *,
        owner_id: UUID,
        reviewer_id: UUID,
        decision: CommentType,
        team_id: UUID | None,
        deliverable_id: UUID,
        task_id: UUID | None,
    ) -> None:
        """Quien entregó se entera de la decisión: aprobar, pedir cambios o
        rechazar son tres avisos distintos (no una única "revisada").

        El dueño nunca se autoaprueba (regla de negocio en la capa de arriba),
        pero el guard queda aquí también por si algún día cambia.
        """
        if owner_id == reviewer_id:
            return
        notification_type = _REVIEW_NOTIFICATION_TYPE.get(decision)
        if notification_type is None:
            return
        gate_field = _REVIEW_GATE_FIELD[decision]
        if not await TeamNotificationGate(self._session).allows(
            team_id=team_id, user_id=owner_id, field=gate_field
        ):
            return

        self._session.add(
            Notification(
                user_to_id=owner_id,
                actor_id=reviewer_id,
                notification_type=notification_type,
                message=_REVIEW_MESSAGE[decision],
                payload={
                    "team_id": str(team_id) if team_id else None,
                    "deliverable_id": str(deliverable_id),
                    "task_id": str(task_id) if task_id else None,
                },
            )
        )
        try:
            await self._broadcaster.publish(
                channel=_channel(owner_id),
                message=json.dumps({"type": "notification.new"}),
            )
        except Exception:
            logger.exception(
                "No se pudo publicar el aviso de revisión al usuario %s", owner_id
            )
