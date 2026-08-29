from datetime import datetime, timezone
from uuid import UUID

from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.enums import InvitationStatus, TeamRole
from app.modules.teams.infrastructure.invitation_repository import (
    TeamInvitationRepository,
)
from app.modules.teams.infrastructure.models import TeamInvitation, TeamMember
from app.modules.teams.presentation.schemas import InvitationResponse
from app.shared.authz import role_satisfies
from app.shared.base_repository import Repository
from app.shared.exceptions import ConflictError, ForbiddenError, NotFoundError

_ADMIN_ROLES = [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]


def _is_admin(system_role) -> bool:
    return role_satisfies(system_role, _ADMIN_ROLES)


class InviteToTeamUseCase:
    """Un líder (o un admin) invita a un integrante del proyecto a su equipo.

    La persona no entra como `TeamMember` hasta que acepta. Reinvitar tras un
    rechazo o una salida reutiliza la fila (vuelve a `pendiente`).
    """

    def __init__(
        self,
        team_repo: TeamRepository,
        invitation_repo: TeamInvitationRepository,
        member_repo: ProjectMemberRepository,
        user_repo: Repository,
    ) -> None:
        self._teams = team_repo
        self._invitations = invitation_repo
        self._members = member_repo
        self._users = user_repo

    async def execute(
        self, project_id: UUID, team_id: UUID, inviter, invitee_user_id: UUID
    ) -> InvitationResponse:
        team = await self._teams.get_team(project_id, team_id)
        if team is None or team.is_deleted:
            raise NotFoundError("El equipo no existe")

        if not _is_admin(inviter.role):
            membership = await self._teams.get_member(team_id, inviter.id)
            if membership is None or membership.team_role != TeamRole.LIDER:
                raise ForbiddenError(
                    "Solo el líder del equipo puede enviar invitaciones"
                )

        invitee = await self._users.get_by_id(invitee_user_id)
        if invitee is None or getattr(invitee, "is_deleted", False):
            raise NotFoundError("El usuario no existe")

        project_membership = await self._members.get_member_by_project_id_and_user_id(
            project_id=project_id, user_id=invitee_user_id
        )
        if project_membership is None or project_membership.is_deleted:
            raise ConflictError(
                "Solo puedes invitar a personas que ya son integrantes del proyecto"
            )

        if await self._teams.get_member(team_id, invitee_user_id) is not None:
            raise ConflictError("La persona ya pertenece al equipo")

        existing = await self._invitations.get_for_team_and_user(
            team_id, invitee_user_id
        )
        if existing is not None:
            if existing.status == InvitationStatus.PENDIENTE:
                raise ConflictError("Esa persona ya tiene una invitación pendiente")
            existing.status = InvitationStatus.PENDIENTE
            existing.invited_by_id = inviter.id
            existing.responded_at = None
            saved = await self._invitations.save(existing)
        else:
            saved = await self._invitations.add(
                TeamInvitation(
                    team_id=team_id,
                    user_id=invitee_user_id,
                    invited_by_id=inviter.id,
                    status=InvitationStatus.PENDIENTE,
                )
            )
        return InvitationResponse.of(saved)


class ListTeamInvitationsUseCase:
    def __init__(
        self, team_repo: TeamRepository, invitation_repo: TeamInvitationRepository
    ) -> None:
        self._teams = team_repo
        self._invitations = invitation_repo

    async def execute(
        self,
        project_id: UUID,
        team_id: UUID,
        viewer,
        status: InvitationStatus | None = None,
    ) -> list[InvitationResponse]:
        team = await self._teams.get_team(project_id, team_id)
        if team is None or team.is_deleted:
            raise NotFoundError("El equipo no existe")
        if not _is_admin(viewer.role):
            membership = await self._teams.get_member(team_id, viewer.id)
            if membership is None or membership.team_role != TeamRole.LIDER:
                raise ForbiddenError(
                    "Solo el líder del equipo o un administrador ven las invitaciones"
                )
        return [
            InvitationResponse.of(i)
            for i in await self._invitations.list_for_team(team_id, status)
        ]


class ListProjectPendingInvitationsUseCase:
    """Visibilidad del admin: todas las invitaciones pendientes del proyecto."""

    def __init__(self, invitation_repo: TeamInvitationRepository) -> None:
        self._invitations = invitation_repo

    async def execute(self, project_id: UUID) -> list[InvitationResponse]:
        return [
            InvitationResponse.of(i)
            for i in await self._invitations.list_pending_for_project(project_id)
        ]


class ListMyInvitationsUseCase:
    def __init__(self, invitation_repo: TeamInvitationRepository) -> None:
        self._invitations = invitation_repo

    async def execute(
        self, user_id: UUID, status: InvitationStatus | None = None
    ) -> list[InvitationResponse]:
        return [
            InvitationResponse.of(i)
            for i in await self._invitations.list_for_user(user_id, status)
        ]


class RespondInvitationUseCase:
    """El invitado acepta o rechaza. Aceptar crea el `TeamMember`."""

    def __init__(
        self,
        invitation_repo: TeamInvitationRepository,
        team_repo: TeamRepository,
        member_repo: ProjectMemberRepository,
    ) -> None:
        self._invitations = invitation_repo
        self._teams = team_repo
        self._members = member_repo

    async def _load_owned_pending(
        self, invitation_id: UUID, user_id: UUID
    ) -> TeamInvitation:
        invitation = await self._invitations.get(invitation_id)
        if invitation is None:
            raise NotFoundError("La invitación no existe")
        if invitation.user_id != user_id:
            raise ForbiddenError("Esta invitación no es tuya")
        if invitation.status != InvitationStatus.PENDIENTE:
            raise ConflictError("La invitación ya fue respondida")
        return invitation

    async def accept(self, invitation_id: UUID, user_id: UUID) -> InvitationResponse:
        invitation = await self._load_owned_pending(invitation_id, user_id)
        team = invitation.team
        project_id = team.project_id if team else None
        if project_id is not None:
            membership = await self._members.get_member_by_project_id_and_user_id(
                project_id=project_id, user_id=user_id
            )
            if membership is None or membership.is_deleted:
                raise ConflictError("Ya no eres integrante del proyecto de este equipo")

        if await self._teams.get_member(invitation.team_id, user_id) is None:
            await self._teams.add_member(
                TeamMember(
                    team_id=invitation.team_id,
                    user_id=user_id,
                    team_role=TeamRole.INTEGRANTE,
                )
            )
        invitation.status = InvitationStatus.ACEPTADA
        invitation.responded_at = datetime.now(timezone.utc)
        return InvitationResponse.of(await self._invitations.save(invitation))

    async def reject(self, invitation_id: UUID, user_id: UUID) -> InvitationResponse:
        invitation = await self._load_owned_pending(invitation_id, user_id)
        invitation.status = InvitationStatus.RECHAZADA
        invitation.responded_at = datetime.now(timezone.utc)
        return InvitationResponse.of(await self._invitations.save(invitation))
