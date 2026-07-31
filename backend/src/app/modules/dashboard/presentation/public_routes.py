from fastapi import APIRouter, Depends

from app.core.dependencies import dashboard_repo_dependency
from app.modules.dashboard.application.use_cases import (
    GetPublicProjectProgressUseCase,
)
from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import (
    PublicProjectAccessRequest,
    PublicProjectProgressResponse,
)

# Router SIN autenticación: el portal del cliente vive fuera del login. La única
# credencial es el token secreto (enviado en el cuerpo). Separado de las rutas del
# dashboard (que sí exigen sesión) para que la ausencia de guard sea explícita y
# auditable.
router = APIRouter(prefix="/public", tags=["Public · Client Portal"])


@router.post("/projects/progress", response_model=PublicProjectProgressResponse)
async def get_public_project_progress(
    body: PublicProjectAccessRequest,
    repo: DashboardRepository = Depends(dashboard_repo_dependency),
) -> PublicProjectProgressResponse:
    """Avance de un proyecto por su token de cliente. 404 si el token no es válido.

    El token viaja en el cuerpo (no en la ruta) para no filtrarlo en logs ni en el
    historial del navegador: el cliente lo introduce en la pantalla de acceso.
    """
    return await GetPublicProjectProgressUseCase(repo).execute(body.token)
