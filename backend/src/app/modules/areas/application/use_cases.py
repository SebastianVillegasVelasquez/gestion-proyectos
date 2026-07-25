from uuid import UUID

from app.modules.areas.domain.metrics import completion_percentage
from app.modules.areas.infrastructure.repository import AreaRepository
from app.modules.areas.presentation.schemas import (
    AreaProgress,
    ProjectAreasResponse,
)
from app.shared.exceptions import NotFoundError


class GetProjectAreasUseCase:
    """Avance por área (cargo) dentro de un proyecto.

    Calcula el porcentaje de cada área con la regla pura del dominio y ordena de
    mayor a menor carga (más tareas asignadas primero), que es lo que el
    organizador quiere ver arriba.
    """

    def __init__(self, repo: AreaRepository) -> None:
        self._repo = repo

    async def execute(self, project_id: UUID) -> ProjectAreasResponse:
        if not await self._repo.project_exists(project_id):
            raise NotFoundError("Proyecto no encontrado")

        rows = await self._repo.area_rows(project_id)

        areas = [
            AreaProgress(
                position=row.position,
                member_count=row.member_count,
                assigned_tasks=row.assigned_tasks,
                completed_tasks=row.completed_tasks,
                completion_pct=completion_percentage(
                    row.completed_tasks, row.assigned_tasks
                ),
            )
            for row in rows
        ]
        areas.sort(key=lambda a: a.assigned_tasks, reverse=True)

        return ProjectAreasResponse(
            project_id=project_id,
            total_assigned=sum(a.assigned_tasks for a in areas),
            total_completed=sum(a.completed_tasks for a in areas),
            areas=areas,
        )
