from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import (
    require_traceability_access,
    traceability_repo_dependency,
)
from app.modules.traceability.application.use_cases import (
    GetProjectTraceabilityUseCase,
)
from app.modules.traceability.infrastructure.repository import TraceabilityRepository
from app.modules.traceability.presentation.schemas import ProjectTraceabilityResponse

router = APIRouter(prefix="/projects", tags=["Traceability"])

# La trazabilidad es para quien organiza el proyecto (coordinador/supervisor del
# proyecto y admins globales). Un líder o supervisor de un equipo también puede
# consultarla acotada a su equipo pasando ?team_id=... — la autorización vive en
# `require_traceability_access`.
_access = require_traceability_access()


@router.get("/{project_id}/traceability", response_model=ProjectTraceabilityResponse)
async def get_project_traceability(
    project_id: UUID,
    team_id: UUID | None = Query(
        None,
        description=(
            "Acota la línea de tiempo a un equipo del proyecto. Obligatorio para "
            "quien no es organizador del proyecto pero lidera/supervisa el equipo."
        ),
    ),
    repo: TraceabilityRepository = Depends(traceability_repo_dependency),
    _=Depends(_access),
) -> ProjectTraceabilityResponse:
    return await GetProjectTraceabilityUseCase(repo).execute(
        project_id, team_id=team_id
    )
