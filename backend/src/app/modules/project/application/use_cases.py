from typing import List
from uuid import UUID

from fastapi import HTTPException
from mypy.nodes import Union

from app.modules.project.domain.services import (
    ProjectService,
    ProjectNodeService,
    ProjectMemberService,
)
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    CreateProjectNodeRequest,
    ProjectResponse,
    UpdateProjectRequest,
    ProjectMemberRequest,
    ProjectMemberResponse,
)
from app.shared.base_repository import Repository


class CreateProjectUseCase:
    def __init__(self, repo: Repository):
        self.repo = repo
        self.service = ProjectService(repo)

    async def execute(self, data: CreateProjectRequest) -> ProjectResponse:
        return await self.service.create_project(data)


class GetProjectsUseCase:
    def __init__(self, repo: "Repository"):
        self.service = ProjectService(repo)

    async def execute(self) -> List["ProjectResponse"]:
        return await self.service.get_all_projects()


class GetProjectByIdUseCase:
    def __init__(self, repo: "Repository"):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> "ProjectResponse":
        return await self.service.get_project_by_id(project_id)


class UpdateProjectUseCase:
    def __init__(self, repo: "Repository"):
        self.service = ProjectService(repo)

    async def execute(
        self, project_id: UUID, data: "UpdateProjectRequest"
    ) -> "ProjectResponse":
        return await self.service.update_project(project_id, data)


class DeleteProjectUseCase:
    def __init__(self, repo: "Repository"):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> None:
        await self.service.delete_project(project_id)


# ProjectNode use cases


class CreateProjectNodeUseCase:
    def __init__(self, project_repo: "Repository", node_repo: "Repository"):
        self.service = ProjectNodeService(node_repo)
        self.project_service = ProjectService(project_repo)

    async def execute(
        self, data: Union[List["CreateProjectNodeRequest"], "CreateProjectNodeRequest"]
    ):
        project_id = data[0].project_id if isinstance(data, list) else data.project_id

        if not project_id:
            raise HTTPException(
                status_code=400,
                detail="El ID del proyecto es obligatorio para crear un nodo",
            )

        exists = await self.project_service.project_exists(project_id)

        if exists is None:
            raise HTTPException(status_code=404, detail="El proyecto no existe")

        return await self.service.create_project_node(data)


# ProjectMember use cases


class AddMemberToProjectUseCase:
    def __init__(
        self,
        user_repo: "Repository",
        member_repo: "ProjectMemberRepository",
        project_repo: "Repository",
    ):
        self.member_service = ProjectMemberService(
            project_repo=project_repo,
            user_repo=user_repo,
            project_member_repo=member_repo,
        )

    async def execute(self, data: "ProjectMemberRequest") -> "ProjectMemberResponse":
        return await self.member_service.add_member_to_project(data)


class GetProjectMembersUseCase:
    def __init__(
        self,
        project_repo: "Repository",
        user_repo: "Repository",
        member_repo: "ProjectMemberRepository",
    ):
        self.service = ProjectMemberService(
            project_repo=project_repo,
            user_repo=user_repo,
            project_member_repo=member_repo,
        )

    async def execute(self, project_id: UUID) -> List["ProjectMemberResponse"]:
        return await self.service.get_project_members(project_id)
