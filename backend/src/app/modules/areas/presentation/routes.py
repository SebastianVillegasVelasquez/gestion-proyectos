from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import area_repo_dependency, require_project_permission
from app.modules.areas.application.use_cases import GetProjectAreasUseCase
from app.modules.areas.infrastructure.repository import AreaRepository
from app.modules.areas.presentation.schemas import ProjectAreasResponse
from app.modules.project.infrastructure.enums import ProjectRole

router = APIRouter(prefix="/projects", tags=["Areas"])

# Mismo criterio que trazabilidad: vista para quien organiza el proyecto
# (coordinador/supervisor); los admin globales pasan siempre.
_organizer = require_project_permission(ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR)


@router.get("/{project_id}/areas", response_model=ProjectAreasResponse)
async def get_project_areas(
    project_id: UUID,
    repo: AreaRepository = Depends(area_repo_dependency),
    _=Depends(_organizer),
) -> ProjectAreasResponse:
    return await GetProjectAreasUseCase(repo).execute(project_id)
