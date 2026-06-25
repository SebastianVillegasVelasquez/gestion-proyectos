from uuid import UUID

from app.modules.collaborators.domain.metrics import completion_percentage
from app.modules.collaborators.domain.repository import CollaboratorRepository
from app.modules.collaborators.presentation.schemas import (
    CollaboratorActivityResponse,
    CollaboratorHistoryItem,
    CollaboratorListItem,
    CollaboratorTaskItem,
    PaginatedCollaboratorsResponse,
)
from app.shared.exceptions import NotFoundError
from app.shared.pagination import Pagination

# Acotan el detalle de la vista de actividad (la lista/historial completos no
# aportan a un resumen y disparan el trabajo de la BD y el payload).
MAX_DETAIL_TASKS = 50
MAX_HISTORY_ENTRIES = 50


class CollaboratorService:
    """Reglas y orquestación del contexto de colaboradores.

    Compone las consultas atómicas del repositorio en las respuestas de la API,
    aplicando el porcentaje de avance (regla de dominio) y el control de
    existencia. Depende de la abstracción CollaboratorRepository (DIP).
    """

    def __init__(self, repo: CollaboratorRepository) -> None:
        self._repo = repo

    async def list_collaborators(
        self, search: str | None, pagination: Pagination
    ) -> PaginatedCollaboratorsResponse:
        total = await self._repo.count_collaborators(search)
        rows = await self._repo.list_collaborator_rows(
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

    async def get_activity(self, user_id: UUID) -> CollaboratorActivityResponse:
        identity = await self._repo.get_identity(user_id)
        if identity is None:
            raise NotFoundError("Colaborador no encontrado")

        counts = await self._repo.get_status_counts(user_id)
        project_count = await self._repo.count_projects(user_id)
        team_count = await self._repo.count_teams(user_id)
        tasks = await self._repo.list_assigned_tasks(user_id, MAX_DETAIL_TASKS)
        history = await self._repo.list_history(user_id, MAX_HISTORY_ENTRIES)

        return CollaboratorActivityResponse(
            user_id=identity.user_id,
            name=identity.name,
            last_name=identity.last_name,
            email=identity.email,
            position=identity.position,
            assigned_tasks=counts.assigned,
            completed_tasks=counts.completed,
            in_progress_tasks=counts.in_progress,
            completion_pct=completion_percentage(counts.completed, counts.assigned),
            project_count=project_count,
            team_count=team_count,
            tasks=[
                CollaboratorTaskItem(
                    id=task.id,
                    title=task.title,
                    status=task.status,
                    due_date=task.due_date,
                    completed_at=task.completed_at,
                )
                for task in tasks
            ],
            history=[
                CollaboratorHistoryItem(
                    id=entry.id,
                    task_id=entry.task_id,
                    task_title=entry.task_title,
                    action=entry.action,
                    old_status=entry.old_status,
                    new_status=entry.new_status,
                    change_reason=entry.change_reason,
                    created_at=entry.created_at,
                )
                for entry in history
            ],
        )
