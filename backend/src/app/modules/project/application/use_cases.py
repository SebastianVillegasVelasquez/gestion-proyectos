from datetime import date, datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException

from app.modules.project.domain.services import ProjectMemberService, ProjectService
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import ProjectMember, ProjectNote
from app.modules.project.infrastructure.repository import (
    ProjectMemberRepository,
    ProjectRepository,
)
from app.modules.project.presentation.schemas import (
    AssignTeamResponse,
    ClientAccessResponse,
    CreateProjectNoteRequest,
    CreateProjectRequest,
    ProjectMemberProgressResponse,
    ProjectMemberRequest,
    ProjectMemberResponse,
    ProjectNoteResponse,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.modules.teams.domain.repository import TeamRepository
from app.shared.authz import role_satisfies
from app.shared.base_repository import Repository
from app.shared.events import EventBus
from app.shared.events.events import MemberAssigned
from app.shared.exceptions import ForbiddenError, NotFoundError


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


class GetClientAccessUseCase:
    """Devuelve (o crea, si faltara) el token del portal del cliente."""

    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> ClientAccessResponse:
        return await self.service.get_client_access(project_id)


class RegenerateClientAccessUseCase:
    """Rota el token: el enlace anterior deja de funcionar (revocación)."""

    def __init__(self, repo: Repository):
        self.service = ProjectService(repo)

    async def execute(self, project_id: UUID) -> ClientAccessResponse:
        return await self.service.regenerate_client_access(project_id)


# ── Notas del proyecto ────────────────────────────────────────────────────────
def _note_to_response(
    note: ProjectNote, author_name: str | None
) -> ProjectNoteResponse:
    return ProjectNoteResponse(
        id=note.id,
        project_id=note.project_id,
        content=note.content,
        note_date=note.note_date,
        author_id=note.author_id,
        author_name=author_name,
        created_at=note.created_at,
    )


class ListProjectNotesUseCase:
    def __init__(self, repo: ProjectRepository):
        self.repo = repo

    async def execute(self, project_id: UUID) -> List[ProjectNoteResponse]:
        rows = await self.repo.get_notes_by_project(project_id)
        return [_note_to_response(note, author_name) for note, author_name in rows]


class CreateProjectNoteUseCase:
    def __init__(self, repo: ProjectRepository):
        self.repo = repo

    async def execute(
        self,
        project_id: UUID,
        data: CreateProjectNoteRequest,
        author_id: UUID,
        author_name: str | None = None,
    ) -> ProjectNoteResponse:
        project = await self.repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise NotFoundError("El proyecto no existe")
        note = ProjectNote(
            project_id=project_id,
            author_id=author_id,
            content=data.content.strip(),
            note_date=data.note_date or date.today(),
        )
        saved = await self.repo.add_note(note)
        return _note_to_response(saved, author_name)


class DeleteProjectNoteUseCase:
    """Borra (lógico) una nota. Solo su autor o un rol elevado pueden hacerlo."""

    def __init__(self, repo: ProjectRepository):
        self.repo = repo

    async def execute(
        self, note_id: UUID, current_user_id: UUID, current_user_role: str
    ) -> None:
        note = await self.repo.get_note_by_id(note_id)
        if not note or note.is_deleted:
            raise NotFoundError("La nota no existe")
        elevated = role_satisfies(current_user_role, ["admin", "super_admin"])
        if note.author_id != current_user_id and not elevated:
            raise ForbiddenError(
                "Solo el autor o un administrador puede borrar la nota"
            )
        note.soft_delete()
        await self.repo.save_note(note)


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


class GetProjectMemberProgressUseCase:
    """Integrantes del proyecto + su avance ponderado (para decidir el pago).

    Combina la lista de integrantes (nombre/correo/cargo/rol) con el avance
    calculado por `ProjectRepository.get_member_progress`, acotado SIEMPRE a
    este proyecto: un integrante puede estar en N proyectos, pero acá solo se
    ve su avance en este. Quien no tiene tareas asignadas queda en 0%.
    """

    def __init__(
        self,
        project_repo: ProjectRepository,
        member_repo: ProjectMemberRepository,
    ):
        self.project_repo = project_repo
        self.member_repo = member_repo

    async def execute(self, project_id: UUID) -> List[ProjectMemberProgressResponse]:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise NotFoundError("Proyecto no encontrado")

        members = await self.member_repo.get_all_members_by_project_id(project_id)
        progress_by_user = await self.project_repo.get_member_progress(project_id)
        teams_by_user = await self.project_repo.get_member_teams(project_id)

        result: List[ProjectMemberProgressResponse] = []
        for member in members:
            progress = progress_by_user.get(member.user_id)
            member_teams = teams_by_user.get(member.user_id, [])
            result.append(
                ProjectMemberProgressResponse(
                    id=member.id,
                    user_id=member.user_id,
                    name=member.user.name,
                    last_name=member.user.last_name,
                    email=member.user.email,
                    position=member.user.position,
                    project_role=member.project_role,
                    tasks_total=progress.tasks_total if progress else 0,
                    tasks_completed=progress.tasks_completed if progress else 0,
                    progress_pct=progress.progress_pct if progress else 0,
                    team_names=[name for _, name in member_teams],
                    team_ids=[team_id for team_id, _ in member_teams],
                )
            )
        return result


class UpdateProjectMemberRoleUseCase:
    def __init__(self, member_repo: ProjectMemberRepository):
        self.service = ProjectMemberService(
            project_repo=None, user_repo=None, project_member_repo=member_repo
        )

    async def execute(self, member_id: UUID, project_role) -> ProjectMemberResponse:
        return await self.service.update_member_role(member_id, project_role)


class RemoveProjectMemberUseCase:
    def __init__(self, member_repo: ProjectMemberRepository):
        self.service = ProjectMemberService(
            project_repo=None, user_repo=None, project_member_repo=member_repo
        )

    async def execute(self, member_id: UUID) -> None:
        await self.service.remove_member(member_id)


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

        team = await self.team_repo.get_team(project_id, team_id)
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
