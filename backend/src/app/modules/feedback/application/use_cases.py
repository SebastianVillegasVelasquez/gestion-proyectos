from uuid import UUID

from app.modules.feedback.domain.repository import FeedbackRepository
from app.modules.feedback.infrastructure.enums import FeedbackStatus
from app.modules.feedback.infrastructure.models import Feedback
from app.modules.feedback.presentation.schemas import (
    CreateFeedbackRequest,
    FeedbackResponse,
    PaginatedFeedbackResponse,
)
from app.shared.exceptions import NotFoundError
from app.shared.pagination import Pagination


def _author_name(feedback: Feedback) -> str | None:
    # Solo seguro cuando la relación viene con selectinload (lista de admin).
    author = feedback.author
    return f"{author.name} {author.last_name}".strip() if author else None


def _to_response(feedback: Feedback, author_name: str | None) -> FeedbackResponse:
    # author_name se pasa explícito: la relación `author` solo está cargada en la
    # lista (selectinload). En el create no se accede (evita un lazy-load async).
    return FeedbackResponse(
        id=feedback.id,
        feedback_type=feedback.feedback_type,
        status=feedback.status,
        message=feedback.message,
        page=feedback.page,
        user_id=feedback.user_id,
        author_name=author_name,
        created_at=feedback.created_at,
    )


class CreateFeedbackUseCase:
    """Persiste el feedback que envía un usuario desde el sitio."""

    def __init__(self, repo: FeedbackRepository) -> None:
        self._repo = repo

    async def execute(
        self, user_id: UUID | None, data: CreateFeedbackRequest
    ) -> FeedbackResponse:
        feedback = await self._repo.add(
            Feedback(
                message=data.message.strip(),
                feedback_type=data.feedback_type,
                page=data.page,
                user_id=user_id,
            )
        )
        # No exponemos author_name aquí: lo envía el propio usuario autenticado.
        return _to_response(feedback, author_name=None)


class UpdateFeedbackStatusUseCase:
    """Cambia el estado de gestión de un feedback (developer)."""

    def __init__(self, repo: FeedbackRepository) -> None:
        self._repo = repo

    async def execute(
        self, feedback_id: UUID, status: FeedbackStatus
    ) -> FeedbackResponse:
        feedback = await self._repo.get(feedback_id)
        if feedback is None:
            raise NotFoundError("Feedback no encontrado")
        feedback.status = status
        saved = await self._repo.save(feedback)
        return _to_response(saved, author_name=_author_name(saved))


class ListFeedbackUseCase:
    """Lista el feedback recibido (bandeja del developer)."""

    def __init__(self, repo: FeedbackRepository) -> None:
        self._repo = repo

    async def execute(self, pagination: Pagination) -> PaginatedFeedbackResponse:
        items, total = await self._repo.list(pagination.limit, pagination.offset)
        return PaginatedFeedbackResponse(
            items=[_to_response(f, author_name=_author_name(f)) for f in items],
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )
