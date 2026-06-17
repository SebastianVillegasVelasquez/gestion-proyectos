from typing import Union, List, Optional
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.project.infrastructure.models import (
    Phase,
    Project,
    ProjectNode,
    ProjectMember,
)
from app.modules.project.infrastructure.repository import (
    PhaseRepository,
    ProjectMemberRepository,
)
from app.modules.project.presentation.schemas import (
    CreatePhaseRequest,
    CreateProjectRequest,
    CreateProjectNodeRequest,
    PhaseResponse,
    ProjectResponse,
    UpdatePhaseRequest,
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
    def __init__(
        self, repo: "Repository", phase_repo: Optional["PhaseRepository"] = None
    ):
        self.repo = repo
        self.phase_repo = phase_repo

    async def create_project_node(
        self, data: Union[List["CreateProjectNodeRequest"], "CreateProjectNodeRequest"]
    ) -> Union[List["ProjectNodeResponse"], "ProjectNodeResponse"]:
        items = data if isinstance(data, list) else [data]
        for item in items:
            await self._validate_phase(item.project_id, item.phase_id)

        if isinstance(data, list):
            return await self._create_node_chain(data)

        return await self._create_single_node(data)

    async def get_nodes_by_project(
        self, project_id: UUID
    ) -> List["ProjectNodeResponse"]:
        nodes = await self.repo.get_all_by_project_id(project_id)
        return [self._to_response(node) for node in nodes]

    async def update_node(
        self, project_id: UUID, node_id: UUID, data
    ) -> "ProjectNodeResponse":
        node = await self.repo.get_by_id(node_id)
        if not node or node.is_deleted or node.project_id != project_id:
            raise HTTPException(status_code=404, detail="Nodo no encontrado")

        payload = data.model_dump(exclude_unset=True)
        if payload.get("phase_id") is not None:
            await self._validate_phase(project_id, payload["phase_id"])

        updated = await self.repo.patch(node, payload)
        return self._to_response(updated)

    async def _validate_phase(self, project_id: UUID, phase_id) -> None:
        if phase_id is None or self.phase_repo is None:
            return
        phase = await self.phase_repo.get_by_id(phase_id)
        if not phase or phase.is_deleted or phase.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La fase indicada no existe en este proyecto",
            )

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
            phase_id=saved_node.phase_id,
            type_label=saved_node.type_label,
            end_date=saved_node.end_date,
        )


class PhaseService:
    """Gestiona las fases de un proyecto.

    Las fases están ordenadas (order_index) y delimitan el flujo de trabajo:
    la fase N+1 no puede iniciar hasta cerrar la fase N. Aquí solo manejamos
    el CRUD; la regla de bloqueo entre fases vive en el módulo de tareas.
    """

    def __init__(self, phase_repo: "PhaseRepository", project_repo: "Repository"):
        self.phase_repo = phase_repo
        self.project_repo = project_repo

    async def create_phase(
        self, project_id: UUID, data: "CreatePhaseRequest"
    ) -> "PhaseResponse":
        await self._ensure_project_exists(project_id)

        order_index = data.order_index
        if order_index is None:
            existing = await self.phase_repo.get_all_by_project_id(project_id)
            order_index = len(existing)

        phase = Phase(
            name=data.name,
            order_index=order_index,
            duration_days=data.duration_days,
            start_date=data.start_date,
            end_date=data.end_date,
            project_id=project_id,
        )
        saved = await self.phase_repo.add(phase)
        return self._to_response(saved)

    async def get_phases(self, project_id: UUID) -> List["PhaseResponse"]:
        await self._ensure_project_exists(project_id)
        phases = await self.phase_repo.get_all_by_project_id(project_id)
        return [self._to_response(p) for p in phases]

    async def update_phase(
        self, project_id: UUID, phase_id: UUID, data: "UpdatePhaseRequest"
    ) -> "PhaseResponse":
        phase = await self._get_owned_phase(project_id, phase_id)
        updated = await self.phase_repo.patch(
            phase, data.model_dump(exclude_unset=True)
        )
        return self._to_response(updated)

    async def delete_phase(self, project_id: UUID, phase_id: UUID) -> None:
        phase = await self._get_owned_phase(project_id, phase_id)
        phase.soft_delete()
        await self.phase_repo.update(phase)

    async def _ensure_project_exists(self, project_id: UUID) -> None:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

    async def _get_owned_phase(self, project_id: UUID, phase_id: UUID) -> "Phase":
        phase = await self.phase_repo.get_by_id(phase_id)
        if not phase or phase.is_deleted or phase.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Fase no encontrada"
            )
        return phase

    @staticmethod
    def _to_response(phase: "Phase") -> "PhaseResponse":
        return PhaseResponse(
            id=phase.id,
            name=phase.name,
            order_index=phase.order_index,
            duration_days=phase.duration_days,
            start_date=phase.start_date,
            end_date=phase.end_date,
            project_id=phase.project_id,
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
        assert self.project_repo is not None, "project_repo must be provided"

        project = await self.project_repo.get_by_id(data.project_id)
        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
            )

        assert self.user_repo is not None, "user_repo must be provided"

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
            email=data.user.email,
            position=data.user.position,
            project_role=data.project_role,
        )
