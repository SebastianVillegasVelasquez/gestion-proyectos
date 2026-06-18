from fastapi import APIRouter, Depends, Query

from app.core.dependencies import dashboard_repo_dependency, require_role
from app.modules.dashboard.application.use_cases import (
    GetDashboardPanelsUseCase,
    GetDashboardSummaryUseCase,
)
from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import (
    DashboardPanelsResponse,
    DashboardSummaryResponse,
)
from app.modules.identity.infrastructure.enums import SystemRole

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_any_role = require_role(SystemRole.ADMIN, SystemRole.SUPER_ADMIN, SystemRole.USER)


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
