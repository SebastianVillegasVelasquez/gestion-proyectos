from uuid import UUID

from app.modules.collaborators.domain.metrics import completion_percentage
from app.modules.collaborators.infrastructure.repository import CollaboratorRepository
from app.modules.collaborators.presentation.schemas import (
    CollaboratorActivityResponse,
    CollaboratorHistoryItem,
    CollaboratorListItem,
    CollaboratorTaskItem,
    PaginatedCollaboratorsResponse,
)
from app.shared.exceptions import NotFoundError
from app.shared.pagination import Pagination


class ListCollaboratorsUseCase:
    """Tabla paginada de colaboradores con su porcentaje de avance.

    La ruta solo delega; el offset/limit vienen del value object Pagination y el
    porcentaje se calcula con la regla pura del dominio.
    """

    def __init__(self, repo: CollaboratorRepository) -> None:
        self._repo = repo

    async def execute(
        self, search: str | None, pagination: Pagination
    ) -> PaginatedCollaboratorsResponse:
        rows, total = await self._repo.list_collaborators(
            search=search, limit=pagination.limit, offset=pagination.offset
        )
        items = [
            CollaboratorListItem(
                user_id=row.user_id,
                name=row.name,
                last_name=row.last_name,
                position=row.position,
                assigned_tasks=row.assigned_tasks,
                completed_tasks=row.completed_tasks,
                completion_pct=completion_percentage(
                    row.completed_tasks, row.assigned_tasks
                ),
            )
            for row in rows
        ]
        return PaginatedCollaboratorsResponse(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class GetCollaboratorActivityUseCase:
    """Detalle de actividad de un colaborador (tareas, proyectos, equipos e
    historial). Lanza NotFoundError si el usuario no existe."""

    def __init__(self, repo: CollaboratorRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> CollaboratorActivityResponse:
        activity = await self._repo.get_activity(user_id)
        if activity is None:
            raise NotFoundError("Colaborador no encontrado")

        return CollaboratorActivityResponse(
            user_id=activity.user_id,
            name=activity.name,
            last_name=activity.last_name,
            email=activity.email,
            position=activity.position,
            assigned_tasks=activity.assigned_tasks,
            completed_tasks=activity.completed_tasks,
            in_progress_tasks=activity.in_progress_tasks,
            completion_pct=completion_percentage(
                activity.completed_tasks, activity.assigned_tasks
            ),
            project_count=activity.project_count,
            team_count=activity.team_count,
            tasks=[
                CollaboratorTaskItem(
                    id=t.id,
                    title=t.title,
                    status=t.status,
                    due_date=t.due_date,
                    completed_at=t.completed_at,
                )
                for t in activity.tasks
            ],
            history=[
                CollaboratorHistoryItem(
                    id=h.id,
                    task_id=h.task_id,
                    task_title=h.task_title,
                    action=h.action,
                    old_status=h.old_status,
                    new_status=h.new_status,
                    change_reason=h.change_reason,
                    created_at=h.created_at,
                )
                for h in activity.history
            ],
        )
