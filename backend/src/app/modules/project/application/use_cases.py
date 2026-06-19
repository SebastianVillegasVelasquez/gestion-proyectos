from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException

from app.modules.project.domain.events import MemberAssigned
from app.modules.project.domain.services import ProjectMemberService, ProjectService
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.project.presentation.schemas import (
    AssignTeamResponse,
    CreateProjectRequest,
    ProjectMemberRequest,
    ProjectMemberResponse,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.modules.teams.domain.repository import TeamRepository
from app.shared.base_repository import Repository
from app.shared.events import EventBus


class CreateProjectUseCase:
    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self, data: CreateProjectRequest) -> ProjectResponse:
        return await self.service.create_project(data)


class GetProjectsUseCase:
    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self) -> List[ProjectResponse]:
        return await self.service.get_all_projects()


class GetProjectByIdUseCase:
    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> ProjectResponse:
        return await self.service.get_project_by_id(project_id)


class UpdateProjectUseCase:
    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(
        self, project_id: UUID, data: UpdateProjectRequest
    ) -> ProjectResponse:
        return await self.service.update_project(project_id, data)


class DeleteProjectUseCase:
    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> None:
        await self.service.delete_project(project_id)


class AddMemberToProjectUseCase:
    def __init__(
        self,
        user_repo: Repository,
        member_repo: ProjectMemberRepository,
        project_repo: Repository,
        event_bus: EventBus | None = None,
    ):
        self.member_service = ProjectMemberService(
            project_repo=project_repo,
            user_repo=user_repo,
            project_member_repo=member_repo,
        )
        self.event_bus = event_bus

    async def execute(
        self,
        data: ProjectMemberRequest,
        assigned_by: UUID | None = None,
    ) -> ProjectMemberResponse:
        response = await self.member_service.add_member_to_project(data)

        if self.event_bus is not None:
            await self.event_bus.publish(
                MemberAssigned(
                    occurred_at=datetime.now(timezone.utc),
                    project_id=data.project_id,
                    user_id=data.user_id,
                    project_role=data.project_role,
                    assigned_by=assigned_by,
                )
            )

        return response


class GetProjectMembersUseCase:
    def __init__(
        self,
        project_repo: Repository,
        user_repo: Repository,
        member_repo: ProjectMemberRepository,
    ):
        self.service = ProjectMemberService(
            project_repo=project_repo,
            user_repo=user_repo,
            project_member_repo=member_repo,
        )

    async def execute(self, project_id: UUID) -> List[ProjectMemberResponse]:
        return await self.service.get_project_members(project_id)


class AssignTeamToProjectUseCase:
    """Opción A (snapshot): copia los integrantes de un equipo al proyecto.

    Cada integrante entra como `integrante` del proyecto (ajustable luego) y se
    marca `source_team_id` para auditar el origen. No duplica si ya es miembro.
    """

    def __init__(
        self,
        project_repo: Repository,
        member_repo: ProjectMemberRepository,
        team_repo: TeamRepository,
    ):
        self.project_repo = project_repo
        self.member_repo = member_repo
        self.team_repo = team_repo

    async def execute(self, project_id: UUID, team_id: UUID) -> AssignTeamResponse:
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
