from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    feedback_repo_dependency,
    get_current_user,
    require_role,
)
from app.modules.feedback.application.use_cases import (
    CreateFeedbackUseCase,
    ListFeedbackUseCase,
    UpdateFeedbackStatusUseCase,
)
from app.modules.feedback.presentation.schemas import (
    CreateFeedbackRequest,
    FeedbackResponse,
    PaginatedFeedbackResponse,
    UpdateFeedbackStatusRequest,
)
from app.modules.identity.presentation.schemas import UserResponse
from app.shared.pagination import Pagination, pagination_params

router = APIRouter(prefix="/feedback", tags=["Feedback"])

# La bandeja de feedback la gestionan el rol técnico (developer) y la
# administración (admin / super_admin): todos ellos revisan lo que llega.
_feedback_manager = require_role("developer", "admin", "super_admin")


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    data: CreateFeedbackRequest,
    repo=Depends(feedback_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Cualquier usuario autenticado puede dejar feedback del sitio."""
    return await CreateFeedbackUseCase(repo).execute(current_user.id, data)


@router.get("/", response_model=PaginatedFeedbackResponse)
async def list_feedback(
    pagination: Pagination = Depends(pagination_params),
    repo=Depends(feedback_repo_dependency),
    current_user=Depends(_feedback_manager),
):
    """Bandeja de feedback recibido (developer y administración)."""
    return await ListFeedbackUseCase(repo).execute(pagination)


@router.patch("/{feedback_id}/status", response_model=FeedbackResponse)
async def update_feedback_status(
    feedback_id: UUID,
    data: UpdateFeedbackStatusRequest,
    repo=Depends(feedback_repo_dependency),
    current_user=Depends(_feedback_manager),
):
    """Cambia el estado de gestión de un feedback (realizado, imposible, etc.)."""
    return await UpdateFeedbackStatusUseCase(repo).execute(feedback_id, data.status)
