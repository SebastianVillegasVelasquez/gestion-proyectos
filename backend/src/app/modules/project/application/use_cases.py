from typing import List
from uuid import UUID

from fastapi import HTTPException
from mypy.nodes import Union

from app.modules.project.domain.services import (
    PhaseService,
    ProjectService,
    ProjectNodeService,
    ProjectMemberService,
)
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.project.infrastructure.repository import (
    PhaseRepository,
    ProjectMemberRepository,
)
from app.modules.teams.domain.repository import TeamRepository
from app.modules.project.presentation.schemas import (
    CreatePhaseRequest,
    CreateProjectRequest,
    CreateProjectNodeRequest,
    PhaseResponse,
    ProjectResponse,
    UpdatePhaseRequest,
    UpdateProjectNodeRequest,
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
    def __init__(
        self,
        project_repo: "Repository",
        node_repo: "Repository",
        phase_repo: "PhaseRepository | None" = None,
    ):
        self.service = ProjectNodeService(node_repo, phase_repo=phase_repo)
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


class GetProjectNodesUseCase:
    def __init__(self, project_repo: "Repository", node_repo: "Repository"):
        self.service = ProjectNodeService(node_repo)
        self.project_service = ProjectService(project_repo)

    async def execute(self, project_id: UUID):
        if not await self.project_service.project_exists(project_id):
            raise HTTPException(status_code=404, detail="El proyecto no existe")
        return await self.service.get_nodes_by_project(project_id)


class UpdateProjectNodeUseCase:
    def __init__(
        self,
        node_repo: "Repository",
        phase_repo: "PhaseRepository | None" = None,
    ):
        self.service = ProjectNodeService(node_repo, phase_repo=phase_repo)

    async def execute(
        self, project_id: UUID, node_id: UUID, data: "UpdateProjectNodeRequest"
    ):
        return await self.service.update_node(project_id, node_id, data)


# Phase use cases


class CreatePhaseUseCase:
    def __init__(self, phase_repo: "PhaseRepository", project_repo: "Repository"):
        self.service = PhaseService(phase_repo=phase_repo, project_repo=project_repo)

    async def execute(
        self, project_id: UUID, data: "CreatePhaseRequest"
    ) -> "PhaseResponse":
        return await self.service.create_phase(project_id, data)


class GetPhasesUseCase:
    def __init__(self, phase_repo: "PhaseRepository", project_repo: "Repository"):
        self.service = PhaseService(phase_repo=phase_repo, project_repo=project_repo)

    async def execute(self, project_id: UUID) -> List["PhaseResponse"]:
        return await self.service.get_phases(project_id)


class UpdatePhaseUseCase:
    def __init__(self, phase_repo: "PhaseRepository", project_repo: "Repository"):
        self.service = PhaseService(phase_repo=phase_repo, project_repo=project_repo)

    async def execute(
        self, project_id: UUID, phase_id: UUID, data: "UpdatePhaseRequest"
    ) -> "PhaseResponse":
        return await self.service.update_phase(project_id, phase_id, data)


class DeletePhaseUseCase:
    def __init__(self, phase_repo: "PhaseRepository", project_repo: "Repository"):
        self.service = PhaseService(phase_repo=phase_repo, project_repo=project_repo)

    async def execute(self, project_id: UUID, phase_id: UUID) -> None:
        await self.service.delete_phase(project_id, phase_id)


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


class AssignTeamToProjectUseCase:
    """Opción A (snapshot): copia los integrantes de un equipo al proyecto.

    Cada integrante entra como `integrante` del proyecto (ajustable luego) y se
    marca `source_team_id` para auditar el origen. No duplica si ya es miembro.
    Depende de TeamRepository por su abstracción (contextos desacoplados).
    """

    def __init__(
        self,
        project_repo: "Repository",
        member_repo: "ProjectMemberRepository",
        team_repo: "TeamRepository",
    ):
        self.project_repo = project_repo
        self.member_repo = member_repo
        self.team_repo = team_repo

    async def execute(self, project_id: UUID, team_id: UUID):
        from app.modules.project.presentation.schemas import AssignTeamResponse

        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise HTTPException(status_code=404, detail="El proyecto no existe")

        team = await self.team_repo.get_team(team_id)
        if not team or team.is_deleted:
            raise HTTPException(status_code=404, detail="El equipo no existe")

        assigned = 0
        skipped = 0
        for team_member in await self.team_repo.list_members(team_id):
            existing = await self.member_repo.get_member_by_project_id_and_user_id(
                project_id=project_id, user_id=team_member.user_id
            )
            if existing is not None:
                skipped += 1
                continue
            await self.member_repo.add(
                ProjectMember(
                    project_id=project_id,
                    user_id=team_member.user_id,
                    project_role=ProjectRole.INTEGRANTE,
                    source_team_id=team_id,
                )
            )
            assigned += 1

        return AssignTeamResponse(assigned=assigned, skipped=skipped)
