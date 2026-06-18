from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import (
    require_project_permission,
    traceability_repo_dependency,
)
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.traceability.application.use_cases import (
    GetProjectTraceabilityUseCase,
)
from app.modules.traceability.infrastructure.repository import TraceabilityRepository
from app.modules.traceability.presentation.schemas import ProjectTraceabilityResponse

router = APIRouter(prefix="/projects", tags=["Traceability"])

# La trazabilidad es para quien organiza el proyecto: coordinador/supervisor del
# proyecto (los admins globales pasan siempre, según require_project_permission).
_organizer = require_project_permission(ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR)


@router.get("/{project_id}/traceability", response_model=ProjectTraceabilityResponse)
async def get_project_traceability(
    project_id: UUID,
    repo: TraceabilityRepository = Depends(traceability_repo_dependency),
    _=Depends(_organizer),
) -> ProjectTraceabilityResponse:
    return await GetProjectTraceabilityUseCase(repo).execute(project_id)
