from typing import Optional

from sqlalchemy import select, UUID
from sqlalchemy.orm import selectinload

from app.modules.project.infrastructure.models import (
    Phase,
    Project,
    ProjectMember,
    ProjectNode,
)
from app.shared.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session):
        super().__init__(session=session, model=Project)


class ProjectNodeRepository(BaseRepository[ProjectNode]):
    def __init__(self, session):
        super().__init__(session=session, model=ProjectNode)

    async def get_all_by_project_id(self, project_id: UUID) -> list[ProjectNode]:
        query = (
            select(ProjectNode)
            .where(
                ProjectNode.project_id == project_id,
                ProjectNode.deleted_at.is_(None),
            )
            .order_by(ProjectNode.created_at)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())


class PhaseRepository(BaseRepository[Phase]):
    def __init__(self, session):
        super().__init__(session=session, model=Phase)

    async def get_all_by_project_id(self, project_id: UUID) -> list[Phase]:
        query = (
            select(Phase)
            .where(Phase.project_id == project_id, Phase.deleted_at.is_(None))
            .order_by(Phase.order_index)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())


class ProjectMemberRepository(BaseRepository[ProjectMember]):
    def __init__(self, session):
        super().__init__(session=session, model=ProjectMember)

    async def get_all_members_by_project_id(
        self, project_id: UUID
    ) -> list[ProjectMember]:
        query = (
            select(ProjectMember)
            .where(ProjectMember.project_id == project_id)
            .options(selectinload(ProjectMember.user))
        )

        result = await self._session.execute(query)

        return list(result.scalars().all())

    async def get_member_by_project_id_and_user_id(
        self, project_id: UUID, user_id: UUID
    ) -> Optional[ProjectMember]:
        query = select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
        result = await self._session.execute(query)
        if result is None:
            raise ModuleNotFoundError("Integrante del proyecto no encontrado")
        return result.scalars().first()
