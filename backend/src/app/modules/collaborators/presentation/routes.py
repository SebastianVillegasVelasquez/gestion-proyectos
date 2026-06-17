from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import collaborator_repo_dependency, require_role
from app.modules.collaborators.application.use_cases import (
    GetCollaboratorActivityUseCase,
    ListCollaboratorsUseCase,
)
from app.modules.collaborators.infrastructure.repository import CollaboratorRepository
from app.modules.collaborators.presentation.schemas import (
    CollaboratorActivityResponse,
    PaginatedCollaboratorsResponse,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.shared.pagination import Pagination, pagination_params

router = APIRouter(prefix="/collaborators", tags=["Collaborators"])

# Vista interna del equipo: cualquier usuario autenticado puede consultarla
# (consistente con el directorio y el listado de equipos). No expone datos
# sensibles (sin contraseñas ni tokens), solo identidad y avance de tareas.
_any_user = require_role(SystemRole.ADMIN, SystemRole.SUPER_ADMIN, SystemRole.USER)


@router.get("/", response_model=PaginatedCollaboratorsResponse)
async def list_collaborators(
    search: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo: CollaboratorRepository = Depends(collaborator_repo_dependency),
    _=Depends(_any_user),
) -> PaginatedCollaboratorsResponse:
    return await ListCollaboratorsUseCase(repo).execute(search, pagination)


@router.get("/{user_id}", response_model=CollaboratorActivityResponse)
async def get_collaborator_activity(
    user_id: UUID,
    repo: CollaboratorRepository = Depends(collaborator_repo_dependency),
    _=Depends(_any_user),
) -> CollaboratorActivityResponse:
    return await GetCollaboratorActivityUseCase(repo).execute(user_id)
