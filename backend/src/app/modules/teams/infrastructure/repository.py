from uuid import UUID

from sqlalchemy import ColumnElement, String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.models import Team, TeamMember

_STATUS = cast(Task.status, String)
_COMPLETED = TaskStatus.COMPLETADA.name


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

    async def get_team(self, project_id: UUID, team_id: UUID) -> Team | None:
        result = await self._session.execute(
            select(Team).where(Team.id == team_id, Team.project_id == project_id)
        )
        return result.scalars().first()

    async def get_team_by_id(self, team_id: UUID) -> Team | None:
        return await self._session.get(Team, team_id)

    async def get_team_by_name(self, project_id: UUID, name: str) -> Team | None:
        result = await self._session.execute(
            select(Team).where(Team.project_id == project_id, Team.name == name)
        )
        return result.scalars().first()

    async def search_teams(
        self, project_id: UUID, search: str | None, limit: int, offset: int
    ) -> tuple[list[Team], int]:
        conditions: list[ColumnElement[bool]] = [
            Team.project_id == project_id,
            Team.deleted_at.is_(None),
        ]
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

    async def list_teams_for_user(self, project_id: UUID, user_id: UUID) -> list[Team]:
        """Equipos vivos de un proyecto a los que pertenece un usuario concreto."""
        rows = (
            (
                await self._session.execute(
                    select(Team)
                    .join(TeamMember, TeamMember.team_id == Team.id)
                    .where(
                        Team.project_id == project_id,
                        Team.deleted_at.is_(None),
                        TeamMember.user_id == user_id,
                    )
                    .order_by(Team.name)
                )
            )
            .scalars()
            .all()
        )
        return list(rows)

    async def count_members(self, team_id: UUID) -> int:
        total = await self._session.scalar(
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.team_id == team_id)
        )
        return int(total or 0)

    async def member_counts(self, team_ids: list[UUID]) -> dict[UUID, int]:
        # Un solo query agrupado para contar integrantes de varios equipos a la vez
        # (evita el N+1 de pedir los miembros equipo por equipo al listar).
        if not team_ids:
            return {}
        rows = (
            await self._session.execute(
                select(TeamMember.team_id, func.count(TeamMember.id))
                .where(TeamMember.team_id.in_(team_ids))
                .group_by(TeamMember.team_id)
            )
        ).all()
        return {team_id: int(count) for team_id, count in rows}

    async def progress_counts(
        self, team_ids: list[UUID]
    ) -> dict[UUID, tuple[int, int]]:
        """Tareas asignadas/completadas por equipo: cuenta las tareas de cada
        integrante del equipo (el mismo criterio que el avance individual),
        agregadas a nivel de equipo."""
        if not team_ids:
            return {}
        rows = (
            await self._session.execute(
                select(
                    TeamMember.team_id,
                    func.count(Task.id).label("assigned"),
                    func.coalesce(
                        func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                )
                .select_from(TeamMember)
                .join(Task, Task.assignee_id == TeamMember.user_id)
                .join(WorkItem, Task.work_item_id == WorkItem.id)
                .where(
                    TeamMember.team_id.in_(team_ids),
                    Task.deleted_at.is_(None),
                )
                .group_by(TeamMember.team_id)
            )
        ).all()
        return {
            team_id: (int(assigned or 0), int(completed or 0))
            for team_id, assigned, completed in rows
        }

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
