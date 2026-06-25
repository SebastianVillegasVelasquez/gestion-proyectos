from uuid import UUID

from app.modules.collaborators.domain.repository import CollaboratorRepository
from app.modules.collaborators.domain.services import CollaboratorService
from app.modules.collaborators.presentation.schemas import (
    CollaboratorActivityResponse,
    PaginatedCollaboratorsResponse,
)
from app.shared.pagination import Pagination


class ListCollaboratorsUseCase:
    def __init__(self, repo: CollaboratorRepository) -> None:
        self._service = CollaboratorService(repo)

    async def execute(
        self, search: str | None, pagination: Pagination
    ) -> PaginatedCollaboratorsResponse:
        return await self._service.list_collaborators(search, pagination)


class GetCollaboratorActivityUseCase:
    def __init__(self, repo: CollaboratorRepository) -> None:
        self._service = CollaboratorService(repo)

    async def execute(self, user_id: UUID) -> CollaboratorActivityResponse:
        return await self._service.get_activity(user_id)
