from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.teams.infrastructure.enums import InvitationStatus
from app.modules.teams.infrastructure.models import Team, TeamInvitation


class TeamInvitationRepository:
    """Persistencia de las invitaciones a equipos.

    Concreta (sin ABC): el flujo se prueba por integración, como el resto del
    módulo de equipos.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    _LOAD = (
        selectinload(TeamInvitation.team),
        selectinload(TeamInvitation.user),
        selectinload(TeamInvitation.invited_by),
    )

    async def add(self, invitation: TeamInvitation) -> TeamInvitation:
        self._session.add(invitation)
        await self._session.flush()
        return await self.get(invitation.id)  # type: ignore[return-value]

    async def save(self, invitation: TeamInvitation) -> TeamInvitation:
        await self._session.flush()
        return await self.get(invitation.id)  # type: ignore[return-value]

    async def get(self, invitation_id: UUID) -> TeamInvitation | None:
        return (
            await self._session.execute(
                select(TeamInvitation)
                .where(TeamInvitation.id == invitation_id)
                .options(*self._LOAD)
            )
        ).scalar_one_or_none()

    async def get_for_team_and_user(
        self, team_id: UUID, user_id: UUID
    ) -> TeamInvitation | None:
        return (
            await self._session.execute(
                select(TeamInvitation)
                .where(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.user_id == user_id,
                )
                .options(*self._LOAD)
            )
        ).scalar_one_or_none()

    async def list_for_team(
        self, team_id: UUID, status: InvitationStatus | None = None
    ) -> list[TeamInvitation]:
        query = (
            select(TeamInvitation)
            .where(TeamInvitation.team_id == team_id)
            .options(*self._LOAD)
            .order_by(TeamInvitation.created_at.desc())
        )
        if status is not None:
            query = query.where(TeamInvitation.status == status)
        return list((await self._session.execute(query)).scalars().all())

    async def list_pending_for_project(self, project_id: UUID) -> list[TeamInvitation]:
        return list(
            (
                await self._session.execute(
                    select(TeamInvitation)
                    .join(Team, TeamInvitation.team_id == Team.id)
                    .where(
                        Team.project_id == project_id,
                        Team.deleted_at.is_(None),
                        TeamInvitation.status == InvitationStatus.PENDIENTE,
                    )
                    .options(*self._LOAD)
                    .order_by(TeamInvitation.created_at.desc())
                )
            )
            .scalars()
            .all()
        )

    async def list_for_user(
        self, user_id: UUID, status: InvitationStatus | None = None
    ) -> list[TeamInvitation]:
        query = (
            select(TeamInvitation)
            .join(Team, TeamInvitation.team_id == Team.id)
            .where(
                TeamInvitation.user_id == user_id,
                Team.deleted_at.is_(None),
            )
            .options(*self._LOAD)
            .order_by(TeamInvitation.created_at.desc())
        )
        if status is not None:
            query = query.where(TeamInvitation.status == status)
        return list((await self._session.execute(query)).scalars().all())
