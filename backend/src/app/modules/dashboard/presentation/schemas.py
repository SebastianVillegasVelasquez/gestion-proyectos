from app.shared.base_model import BaseModelConfig


class DashboardSummaryResponse(BaseModelConfig):
    active_projects: int
    total_tasks: int
    completed_tasks: int
    in_review_tasks: int
    overdue_tasks: int
