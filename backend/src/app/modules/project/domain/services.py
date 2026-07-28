from typing import List, Optional, Union
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.project.domain.client_access import generate_client_token
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.infrastructure.repository import (
    ProjectMemberRepository,
    ProjectRepository,
)
from app.modules.project.presentation.schemas import (
    ClientAccessResponse,
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
        project = Project(**data.model_dump())
        # Enlace del cliente listo desde la creación: no hay que "activarlo" aparte.
        project.client_access_token = generate_client_token()
        persisted = await self.repo.save(project)
        # Nuevo proyecto: aún no hay tareas, así que el progreso es 0.
        return self._to_response(persisted, progress_pct=0.0)

    async def get_client_access(self, project_id: UUID) -> ClientAccessResponse:
        project = await self._get_active(project_id)
        if not project.client_access_token:
            # Proyectos creados antes de esta función: generamos el token al vuelo.
            project.client_access_token = generate_client_token()
            await self.repo.update(project)
        return ClientAccessResponse(token=project.client_access_token)

    async def regenerate_client_access(self, project_id: UUID) -> ClientAccessResponse:
        project = await self._get_active(project_id)
        project.client_access_token = generate_client_token()
        await self.repo.update(project)
        return ClientAccessResponse(token=project.client_access_token)

    async def project_exists(self, project_id) -> bool:
        project: Union[Project, None] = await self.repo.get_by_id(project_id)
        return project is not None and not project.is_deleted

    async def get_all_projects(self) -> List[ProjectResponse]:
        projects = await self.repo.get_all()
        # Progreso derivado de tareas en un solo query (evita N+1).
        progress = await self._progress_map([p.id for p in projects])
        return [
            self._to_response(p, progress_pct=progress.get(p.id, 0.0)) for p in projects
        ]

    async def get_project_by_id(self, project_id: UUID) -> ProjectResponse:
        project = await self._get_active(project_id)
        progress = await self._progress_map([project.id])
        return self._to_response(project, progress_pct=progress.get(project.id, 0.0))

    async def update_project(
        self, project_id: UUID, data: UpdateProjectRequest
    ) -> ProjectResponse:
        project = await self._get_active(project_id)
        updated = await self.repo.patch(project, data.model_dump(exclude_unset=True))
        progress = await self._progress_map([updated.id])
        return self._to_response(updated, progress_pct=progress.get(updated.id, 0.0))

    async def _progress_map(self, project_ids: list[UUID]) -> dict[UUID, float]:
        """Batch: pide el progreso de todos los proyectos al ProjectRepository.
        Si el repo inyectado no lo soporta (tests con doubles), devuelve {}.
        """
        if not project_ids or not isinstance(self.repo, ProjectRepository):
            return {}
        return await self.repo.get_progress_map(project_ids)

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
    def _to_response(
        project: Project, progress_pct: float | None = None
    ) -> ProjectResponse:
        # progress_pct viene derivado de tareas: la columna almacenada quedó
        # como legado y no se actualiza. Si no se pasa (p. ej. desde tests que
        # llaman helpers viejos), caemos al valor guardado.
        pct = (
            progress_pct
            if progress_pct is not None
            else float(getattr(project, "progress_pct", 0.0) or 0.0)
        )
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description or "",
            client_name=project.client_name or "",
            start_date=project.start_date,
            end_date=project.end_date,
            progress_pct=pct,
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

        # Un usuario no puede figurar dos veces en el mismo proyecto: si ya es
        # integrante, es un alta duplicada (el frontend además lo oculta del
        # selector, pero la regla vive aquí para cualquier vía de entrada).
        existing = await self.project_member_repo.get_member_by_project_id_and_user_id(
            project_id=data.project_id, user_id=data.user_id
        )
        if existing is not None and not existing.is_deleted:
            raise HTTPException(
                status_code=409, detail="El usuario ya es integrante del proyecto"
            )

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
