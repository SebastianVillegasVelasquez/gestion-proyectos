from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.models import Team, TeamMember


class SqlAlchemyTeamRepository(TeamRepository):
    """Implementación concreta del contrato TeamRepository con SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _persist(self, entity):
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    # ── Equipos ──────────────────────────────────────────────────────────────
    async def add_team(self, team: Team) -> Team:
        return await self._persist(team)

    async def save_team(self, team: Team) -> Team:
        return await self._persist(team)

    async def get_team(self, team_id: UUID) -> Team | None:
        return await self._session.get(Team, team_id)

    async def get_team_by_name(self, name: str) -> Team | None:
        result = await self._session.execute(select(Team).where(Team.name == name))
        return result.scalars().first()

    async def search_teams(
        self, search: str | None, limit: int, offset: int
    ) -> tuple[list[Team], int]:
        conditions = [Team.deleted_at.is_(None)]
        if search:
            like = f"%{search.strip()}%"
            conditions.append(or_(Team.name.ilike(like), Team.description.ilike(like)))
        total = await self._session.scalar(
            select(func.count()).select_from(Team).where(*conditions)
        )
        rows = (
            (
                await self._session.execute(
                    select(Team)
                    .where(*conditions)
                    .order_by(Team.name)
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)

    # ── Integrantes ──────────────────────────────────────────────────────────
    async def add_member(self, member: TeamMember) -> TeamMember:
        return await self._persist(member)

    async def save_member(self, member: TeamMember) -> TeamMember:
        return await self._persist(member)

    async def get_member(self, team_id: UUID, user_id: UUID) -> TeamMember | None:
        result = await self._session.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
            .options(selectinload(TeamMember.user))
        )
        return result.scalars().first()

    async def list_members(self, team_id: UUID) -> list[TeamMember]:
        result = await self._session.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .options(selectinload(TeamMember.user))
            .order_by(TeamMember.created_at)
        )
        return list(result.scalars().all())

    async def delete_member(self, member: TeamMember) -> None:
        await self._session.delete(member)
        await self._session.flush()
