from typing import List
from uuid import UUID

from mypy.nodes import Union

from app.modules.project.domain.services import ProjectService, ProjectNodeService
from app.modules.project.infrastructure.repository import ProjectRepository
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    CreateProjectNodeRequest,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.shared.base_repository import Repository


class CreateProjectUseCase:
    def __init__(self, repo: ProjectRepository):
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


class CreateProjectNodeUseCase:
    def __init__(self, repo: "Repository"):
        self.service = ProjectNodeService(repo)
        self.project_service = ProjectService(repo)

    async def execute(
        self, data: Union[List["CreateProjectNodeRequest"], "CreateProjectNodeRequest"]
    ):
        project_id = data[0].project_id if isinstance(data, list) else data.project_id

        exists = await self.project_service.project_exists(project_id)

        if exists:
            return await self.service.create_project_node(data)

        return None
