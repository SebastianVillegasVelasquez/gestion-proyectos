from typing import Union, List, Optional
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.project.infrastructure.models import (
    Project,
    ProjectNode,
    ProjectMember,
)
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    CreateProjectNodeRequest,
    ProjectResponse,
    UpdateProjectRequest,
    ProjectNodeResponse,
    ProjectMemberRequest,
    ProjectMemberResponse,
)
from app.shared.base_repository import Repository


class ProjectService:
    def __init__(self, repo: Repository):
        self.repo = repo

    async def create_project(self, data: "CreateProjectRequest"):
        project_orm = self._create_project_orm(data)
        persisted_project = await self.repo.save(project_orm)
        return self._to_response(persisted_project)

    async def project_exists(self, project_id):
        project_exist: Union["Project", None] = await self.repo.get_by_id(project_id)
        return True if project_exist else False

    async def get_all_projects(self) -> List["ProjectResponse"]:
        projects = await self.repo.get_all()
        return [self._to_response(p) for p in projects]

    async def get_project_by_id(self, project_id: UUID) -> ProjectResponse:
        project = await self.repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

        return self._to_response(project)

    async def update_project(
        self, project_id: UUID, data: UpdateProjectRequest
    ) -> "ProjectResponse":
        project = await self.repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

        updated_data = data.model_dump(exclude_unset=True)
        updated_project = await self.repo.patch(project, updated_data)

        return self._to_response(updated_project)

    async def delete_project(self, project_id: UUID) -> None:
        project = await self.repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

        project.soft_delete()

        await self.repo.update(project)

    @staticmethod
    def _create_project_orm(data: CreateProjectRequest):
        return Project(**data.model_dump())

    @staticmethod
    def _to_response(project: "Project") -> "ProjectResponse":
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description or "",
            client_name=project.client_name or "",
            start_date=project.start_date,
            end_date=project.end_date,
            progress_pct=getattr(project, "progress_pct", 0.0),
        )


class ProjectNodeService:
    def __init__(self, repo: "Repository"):
        self.repo = repo

    async def create_project_node(
        self, data: Union[List["CreateProjectNodeRequest"], "CreateProjectNodeRequest"]
    ) -> Union[List["ProjectNodeResponse"], "ProjectNodeResponse"]:
        if isinstance(data, list):
            return await self._create_node_chain(data)

        return await self._create_single_node(data)

    async def _create_single_node(
        self, data: "CreateProjectNodeRequest"
    ) -> "ProjectNodeResponse":
        node_orm = ProjectNode(**data.model_dump())
        saved_node = await self.repo.add(node_orm)
        return self._to_response(saved_node)

    async def _create_node_chain(
        self, data_list: List["CreateProjectNodeRequest"]
    ) -> List["ProjectNodeResponse"]:
        created_nodes = []
        current_parent_id = None

        for request_data in data_list:
            node_dict = request_data.model_dump()

            if current_parent_id is not None and node_dict.get("parent_id") is None:
                node_dict["parent_id"] = current_parent_id

            node_orm = ProjectNode(**node_dict)
            saved_node = await self.repo.add(node_orm)

            created_nodes.append(saved_node)

            current_parent_id = saved_node.id

        return [self._to_response(node) for node in created_nodes]

    @staticmethod
    def _to_response(saved_node: "ProjectNode") -> "ProjectNodeResponse":
        return ProjectNodeResponse(
            id=saved_node.id,
            name=saved_node.name,
            node_type=saved_node.node_type,
            project_id=saved_node.project_id,
            parent_id=saved_node.parent_id,
        )


class ProjectMemberService:
    def __init__(
        self,
        project_repo: Optional["Repository"],
        user_repo: Optional["Repository"],
        project_member_repo: "ProjectMemberRepository",
    ):
        self.project_repo = project_repo
        self.user_repo = user_repo
        self.project_member_repo = project_member_repo

    async def add_member_to_project(self, data: ProjectMemberRequest):
        project = await self.project_repo.get_by_id(data.project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

        user = await self.user_repo.get_by_id(data.user_id)
        if not user or user.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
            )

        member_orm = self._to_orm(data)

        persisted_member = await self.project_member_repo.add(member_orm)

        return self._to_member_response(persisted_member)

    async def get_project_members(self, project_id: UUID):
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        members_orm = await self.project_member_repo.get_all_members_by_project_id(
            project_id
        )

        return [self._to_member_response(member) for member in members_orm]

    @staticmethod
    def _to_orm(data: ProjectMemberRequest):
        return ProjectMember(**data.model_dump())

    @staticmethod
    def _to_member_response(data: "ProjectMember") -> "ProjectMemberResponse":
        return ProjectMemberResponse(
            user_id=data.user_id,
            name=data.user.name,
            last_name=data.user.last_name,
            position=data.user.position,
            project_role=data.role,
        )
