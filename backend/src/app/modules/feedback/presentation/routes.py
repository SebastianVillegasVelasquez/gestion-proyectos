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
)
from app.modules.feedback.presentation.schemas import (
    CreateFeedbackRequest,
    FeedbackResponse,
    PaginatedFeedbackResponse,
)
from app.modules.identity.presentation.schemas import UserResponse
from app.shared.pagination import Pagination, pagination_params

router = APIRouter(prefix="/feedback", tags=["Feedback"])


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
    current_user=Depends(require_role("admin", "super_admin")),
):
    """Bandeja de feedback recibido (solo administración)."""
    return await ListFeedbackUseCase(repo).execute(pagination)
