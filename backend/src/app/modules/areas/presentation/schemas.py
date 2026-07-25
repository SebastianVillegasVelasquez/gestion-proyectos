from uuid import UUID

from app.shared.base_model import BaseModelConfig


class AreaProgress(BaseModelConfig):
    """Avance de un área (cargo) dentro del proyecto."""

    position: str
    member_count: int
    assigned_tasks: int
    completed_tasks: int
    completion_pct: int


class ProjectAreasResponse(BaseModelConfig):
    project_id: UUID
    total_assigned: int
    total_completed: int
    areas: list[AreaProgress]
