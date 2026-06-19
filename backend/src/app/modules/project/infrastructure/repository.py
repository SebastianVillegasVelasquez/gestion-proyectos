from typing import Optional

from sqlalchemy import UUID, select
from sqlalchemy.orm import selectinload

from app.modules.project.infrastructure.models import Project, ProjectMember
from app.shared.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session):
        super().__init__(session=session, model=Project)


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
        return result.scalars().first()
