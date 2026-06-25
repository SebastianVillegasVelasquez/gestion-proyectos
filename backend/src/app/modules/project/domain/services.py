from typing import List, Optional, Union
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    ProjectMemberRequest,
    ProjectMemberResponse,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.shared.base_repository import Repository


class ProjectService:
    def __init__(self, repo: Repository):
        self.repo = repo

    async def create_project(self, data: CreateProjectRequest) -> ProjectResponse:
        persisted = await self.repo.save(Project(**data.model_dump()))
        return self._to_response(persisted)

    async def project_exists(self, project_id) -> bool:
        project: Union[Project, None] = await self.repo.get_by_id(project_id)
        return project is not None and not project.is_deleted

    async def get_all_projects(self) -> List[ProjectResponse]:
        projects = await self.repo.get_all()
        return [self._to_response(p) for p in projects]

    async def get_project_by_id(self, project_id: UUID) -> ProjectResponse:
        return self._to_response(await self._get_active(project_id))

    async def update_project(
        self, project_id: UUID, data: UpdateProjectRequest
    ) -> ProjectResponse:
        project = await self._get_active(project_id)
        updated = await self.repo.patch(project, data.model_dump(exclude_unset=True))
        return self._to_response(updated)

    async def delete_project(self, project_id: UUID) -> None:
        project = await self._get_active(project_id)
        project.soft_delete()
        await self.repo.update(project)

    async def _get_active(self, project_id: UUID) -> Project:
        project = await self.repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )
        return project

    @staticmethod
    def _to_response(project: Project) -> ProjectResponse:
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description or "",
            client_name=project.client_name or "",
            start_date=project.start_date,
            end_date=project.end_date,
            progress_pct=getattr(project, "progress_pct", 0.0),
        )


class ProjectMemberService:
    def __init__(
        self,
        project_repo: Optional[Repository],
        user_repo: Optional[Repository],
        project_member_repo: ProjectMemberRepository,
    ):
        self.project_repo = project_repo
        self.user_repo = user_repo
        self.project_member_repo = project_member_repo

    async def add_member_to_project(
        self, data: ProjectMemberRequest
    ) -> ProjectMemberResponse:
        assert self.project_repo is not None and self.user_repo is not None

        project = await self.project_repo.get_by_id(data.project_id)
        if not project or project.is_deleted:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        user = await self.user_repo.get_by_id(data.user_id)
        if not user or user.is_deleted:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        persisted = await self.project_member_repo.add(
            ProjectMember(**data.model_dump())
        )
        return self._to_member_response(persisted)

    async def get_project_members(
        self, project_id: UUID
    ) -> list[ProjectMemberResponse]:
        assert self.project_repo is not None
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        members = await self.project_member_repo.get_all_members_by_project_id(
            project_id
        )
        return [self._to_member_response(m) for m in members]

    @staticmethod
    def _to_member_response(member: ProjectMember) -> ProjectMemberResponse:
        return ProjectMemberResponse(
            user_id=member.user_id,
            name=member.user.name,
            last_name=member.user.last_name,
            email=member.user.email,
            position=member.user.position,
            project_role=member.project_role,
        )
