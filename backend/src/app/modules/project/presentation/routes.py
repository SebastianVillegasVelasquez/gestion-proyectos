import datetime
import re
from dataclasses import asdict
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from starlette import status

from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus

from app.core.database import get_db
from app.core.dependencies import (
    event_bus_dependency,
    project_members_repo_dependency,
    project_repo_dependency,
    require_role,
    user_repo_dependency,
)
from app.modules.project.application.use_cases import (
    AddMemberToProjectUseCase,
    CreateProjectNoteUseCase,
    CreateProjectUseCase,
    DeleteProjectNoteUseCase,
    DeleteProjectUseCase,
    GetClientAccessUseCase,
    GetProjectByIdUseCase,
    GetProjectMemberProgressUseCase,
    GetProjectMembersUseCase,
    GetProjectsUseCase,
    ListProjectNotesUseCase,
    RegenerateClientAccessUseCase,
    RemoveProjectMemberUseCase,
    UpdateProjectMemberRoleUseCase,
    UpdateProjectUseCase,
)
from app.modules.project.application.analytics import (
    AnalyticsFilters,
    ProjectAnalyticsBuilder,
)
from app.modules.project.application.analytics_html import render_analytics_html
from app.modules.project.presentation.analytics_schemas import (
    ProjectAnalyticsResponse,
)
from app.modules.project.presentation.schemas import (
    ClientAccessResponse,
    CreateProjectNoteRequest,
    CreateProjectRequest,
    ProjectMemberProgressResponse,
    ProjectMemberRequest,
    ProjectMemberResponse,
    ProjectNoteResponse,
    ProjectResponse,
    UpdateProjectMemberRoleRequest,
    UpdateProjectRequest,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: CreateProjectRequest,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await CreateProjectUseCase(repo).execute(data)


@router.get("/", response_model=List[ProjectResponse])
async def get_all_projects(
    repo=Depends(project_repo_dependency),
    # Listado completo (todos los proyectos, sin acotar por membresía): es
    # vista de gestión. El rol user consulta sus proyectos vía /dashboard/me/*
    # (ya acotado por membresía); si pudiera pegarle a este endpoint vería la
    # lista completa de la organización sin filtro alguno.
    _=Depends(require_role("admin", "super_admin")),
):
    return await GetProjectsUseCase(repo).execute()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetProjectByIdUseCase(repo).execute(project_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: UpdateProjectRequest,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await UpdateProjectUseCase(repo).execute(project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("super_admin")),
):
    await DeleteProjectUseCase(repo).execute(project_id)


# ── Acceso del cliente (enlace público de solo lectura) ──────────────────────
@router.get("/{project_id}/client-access", response_model=ClientAccessResponse)
async def get_client_access(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    """Token del portal del cliente para armar y compartir el enlace."""
    return await GetClientAccessUseCase(repo).execute(project_id)


@router.post(
    "/{project_id}/client-access/regenerate", response_model=ClientAccessResponse
)
async def regenerate_client_access(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    """Rota el token: invalida el enlace anterior (revocación)."""
    return await RegenerateClientAccessUseCase(repo).execute(project_id)


# ── Notas del proyecto ───────────────────────────────────────────────────────
@router.get("/{project_id}/notes", response_model=List[ProjectNoteResponse])
async def list_project_notes(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    """Notas/recordatorios del proyecto (más recientes primero)."""
    return await ListProjectNotesUseCase(repo).execute(project_id)


@router.post(
    "/{project_id}/notes",
    response_model=ProjectNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_note(
    project_id: UUID,
    data: CreateProjectNoteRequest,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    return await CreateProjectNoteUseCase(repo).execute(
        project_id,
        data,
        author_id=current_user.id,
        author_name=f"{current_user.name} {current_user.last_name}",
    )


@router.delete("/{project_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_note(
    project_id: UUID,
    note_id: UUID,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    """Borra una nota. Solo su autor o un administrador pueden hacerlo."""
    await DeleteProjectNoteUseCase(repo).execute(
        note_id, current_user.id, current_user.role
    )


# ── Miembros del proyecto ────────────────────────────────────────────────────
@router.post("/members/", status_code=status.HTTP_201_CREATED)
async def add_project_member(
    payload: ProjectMemberRequest,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    event_bus=Depends(event_bus_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    return await AddMemberToProjectUseCase(
        user_repo=user_repo,
        member_repo=project_member_repo,
        project_repo=project_repo,
        event_bus=event_bus,
    ).execute(payload, assigned_by=current_user.id)


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def get_project_members(
    project_id: UUID,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    return await GetProjectMembersUseCase(
        project_repo=project_repo,
        user_repo=user_repo,
        member_repo=project_member_repo,
    ).execute(project_id)


@router.get(
    "/{project_id}/members/progress",
    response_model=List[ProjectMemberProgressResponse],
)
async def get_project_member_progress(
    project_id: UUID,
    project_repo=Depends(project_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    _=Depends(require_role("admin", "super_admin", "user")),
):
    """Integrantes de ESTE proyecto con su avance ponderado (para el pago).

    No mezcla información de otros proyectos: un integrante puede estar en N
    proyectos, pero el avance que se ve aquí es únicamente el de este.
    """
    return await GetProjectMemberProgressUseCase(
        project_repo=project_repo,
        member_repo=project_member_repo,
    ).execute(project_id)


@router.patch("/members/{member_id}", response_model=ProjectMemberResponse)
async def update_project_member_role(
    member_id: UUID,
    payload: UpdateProjectMemberRoleRequest,
    project_member_repo=Depends(project_members_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    return await UpdateProjectMemberRoleUseCase(project_member_repo).execute(
        member_id, payload.project_role
    )


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    member_id: UUID,
    project_member_repo=Depends(project_members_repo_dependency),
    _=Depends(require_role("admin", "super_admin")),
):
    await RemoveProjectMemberUseCase(project_member_repo).execute(member_id)


# ── Informe / analítica ──────────────────────────────────────────────────────


def _analytics_filters(
    date_from: datetime.date | None,
    date_to: datetime.date | None,
    team_id: UUID | None,
    assignee_id: UUID | None,
    status_filter: TaskStatus | None,
    priority: TaskPriority | None,
    work_item_id: UUID | None,
) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        team_id=team_id,
        assignee_id=assignee_id,
        status=status_filter,
        priority=priority.value if priority else None,
        work_item_id=work_item_id,
    )


@router.get("/{project_id}/analytics", response_model=ProjectAnalyticsResponse)
async def get_project_analytics(
    project_id: UUID,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    team_id: UUID | None = None,
    assignee_id: UUID | None = None,
    status_filter: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    work_item_id: UUID | None = None,
    db=Depends(get_db),
    _=Depends(require_role("admin", "super_admin")),
):
    """Analítica del informe interactivo: rendimiento en el tiempo, por equipo,
    individual y por lapsos de entrega. Duraciones en días laborables."""
    analytics = await ProjectAnalyticsBuilder(db).build(
        project_id,
        _analytics_filters(
            date_from,
            date_to,
            team_id,
            assignee_id,
            status_filter,
            priority,
            work_item_id,
        ),
    )
    return ProjectAnalyticsResponse(**asdict(analytics))


@router.get("/{project_id}/analytics.html")
async def export_project_analytics_html(
    project_id: UUID,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    team_id: UUID | None = None,
    assignee_id: UUID | None = None,
    status_filter: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    work_item_id: UUID | None = None,
    db=Depends(get_db),
    _=Depends(require_role("admin", "super_admin")),
):
    """El informe como un HTML autocontenido y descargable (sustituye al CSV)."""
    analytics = await ProjectAnalyticsBuilder(db).build(
        project_id,
        _analytics_filters(
            date_from,
            date_to,
            team_id,
            assignee_id,
            status_filter,
            priority,
            work_item_id,
        ),
    )
    safe_name = (
        re.sub(r"[^\w\-]+", "_", analytics.project_name).strip("_") or "proyecto"
    )
    return Response(
        content=render_analytics_html(analytics),
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="informe_{safe_name}.html"'
        },
    )
