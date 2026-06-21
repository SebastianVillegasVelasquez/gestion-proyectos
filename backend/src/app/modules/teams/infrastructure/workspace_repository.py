from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.teams.domain.workspace import WorkspaceRepository
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
)


class SqlAlchemyWorkspaceRepository(WorkspaceRepository):
    """Implementación SQLAlchemy del contrato WorkspaceRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _persist(self, entity):
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def get_member_role(self, team_id: UUID, user_id: UUID) -> TeamRole | None:
        return await self._session.scalar(
            select(TeamMember.team_role).where(
                TeamMember.team_id == team_id, TeamMember.user_id == user_id
            )
        )

    def _with_children(self):
        return select(Deliverable).options(
            selectinload(Deliverable.versions),
            selectinload(Deliverable.comments),
        )

    async def list_deliverables(self, team_id: UUID) -> list[Deliverable]:
        rows = await self._session.execute(
            self._with_children()
            .where(Deliverable.team_id == team_id, Deliverable.deleted_at.is_(None))
            .order_by(Deliverable.created_at.desc())
        )
        return list(rows.scalars().all())

    async def get_deliverable(
        self, team_id: UUID, deliverable_id: UUID
    ) -> Deliverable | None:
        return await self._session.scalar(
            self._with_children().where(
                Deliverable.id == deliverable_id,
                Deliverable.team_id == team_id,
                Deliverable.deleted_at.is_(None),
            )
        )

    async def add_deliverable(self, deliverable: Deliverable) -> Deliverable:
        return await self._persist(deliverable)

    async def save_deliverable(self, deliverable: Deliverable) -> Deliverable:
        return await self._persist(deliverable)

    async def add_version(self, version: DeliverableVersion) -> DeliverableVersion:
        return await self._persist(version)

    async def add_comment(self, comment: DeliverableComment) -> DeliverableComment:
        return await self._persist(comment)
