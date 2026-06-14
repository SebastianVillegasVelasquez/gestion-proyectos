from fastapi import APIRouter, Depends

from app.core.dependencies import dashboard_repo_dependency, require_role
from app.modules.dashboard.application.use_cases import GetDashboardSummaryUseCase
from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import DashboardSummaryResponse
from app.modules.identity.infrastructure.enums import SystemRole

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    _=Depends(require_role(SystemRole.ADMIN, SystemRole.SUPER_ADMIN, SystemRole.USER)),
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> DashboardSummaryResponse:
    use_case = GetDashboardSummaryUseCase(repo)
    return await use_case.execute()
