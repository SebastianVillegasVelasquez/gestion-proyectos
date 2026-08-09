from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import (
    dashboard_repo_dependency,
    get_current_user,
    require_role,
)
from app.modules.dashboard.application.use_cases import (
    GetDashboardPanelsUseCase,
    GetDashboardSummaryUseCase,
    GetMyDashboardPanelsUseCase,
    GetMyDashboardSummaryUseCase,
    GetMyProjectProgressUseCase,
    GetRecentActivityUseCase,
)
from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import (
    DashboardPanelsResponse,
    DashboardSummaryResponse,
    MyProjectProgressResponse,
    RecentActivityResponse,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.presentation.schemas import UserResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_any_role = require_role(SystemRole.ADMIN, SystemRole.SUPER_ADMIN, SystemRole.USER)
# La actividad reciente es transversal a todos los proyectos: solo la ve la gestión.
_admin_role = require_role(
    SystemRole.DEVELOPER, SystemRole.SUPER_ADMIN, SystemRole.ADMIN
)


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    _=Depends(_any_role),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> DashboardSummaryResponse:
    return await GetDashboardSummaryUseCase(repo).execute()


@router.get("/panels", response_model=DashboardPanelsResponse)
async def get_dashboard_panels(
    board_limit: int = Query(6, ge=1, le=20),
    projects_limit: int = Query(8, ge=1, le=20),
    deadlines_limit: int = Query(8, ge=1, le=20),
    _=Depends(_any_role),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> DashboardPanelsResponse:
    return await GetDashboardPanelsUseCase(repo).execute(
        board_limit=board_limit,
        projects_limit=projects_limit,
        deadlines_limit=deadlines_limit,
    )


@router.get("/activity", response_model=RecentActivityResponse)
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=30),
    _=Depends(_admin_role),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> RecentActivityResponse:
    """Últimos eventos del sistema (creación, entrega, aprobación…) de todos los proyectos."""
    return await GetRecentActivityUseCase(repo).execute(limit=limit)


# ── Dashboard del usuario autenticado (rol User): solo su información ──────────


@router.get("/me/summary", response_model=DashboardSummaryResponse)
async def get_my_dashboard_summary(
    current_user: UserResponse = Depends(get_current_user),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> DashboardSummaryResponse:
    return await GetMyDashboardSummaryUseCase(repo).execute(current_user.id)


@router.get("/me/panels", response_model=DashboardPanelsResponse)
async def get_my_dashboard_panels(
    board_limit: int = Query(6, ge=1, le=20),
    projects_limit: int = Query(8, ge=1, le=20),
    deadlines_limit: int = Query(8, ge=1, le=20),
    current_user: UserResponse = Depends(get_current_user),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> DashboardPanelsResponse:
    return await GetMyDashboardPanelsUseCase(repo).execute(
        user_id=current_user.id,
        board_limit=board_limit,
        projects_limit=projects_limit,
        deadlines_limit=deadlines_limit,
    )


@router.get("/me/projects/{project_id}", response_model=MyProjectProgressResponse)
async def get_my_project_progress(
    project_id: UUID,
    current_user: UserResponse = Depends(get_current_user),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> MyProjectProgressResponse:
    """Progreso general de un proyecto (solo lectura). 404 si no eres miembro."""
    return await GetMyProjectProgressUseCase(repo).execute(
        user_id=current_user.id, project_id=project_id
    )
