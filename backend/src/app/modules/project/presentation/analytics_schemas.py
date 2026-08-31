from uuid import UUID

from app.shared.base_model import BaseModelConfig


class SeriesPointResponse(BaseModelConfig):
    date: str
    ideal: float
    actual: int


class WeekCountResponse(BaseModelConfig):
    week_start: str
    count: int


class OverviewResponse(BaseModelConfig):
    total_tasks: int
    by_status: dict[str, int]
    progress_pct: int
    overdue_open: int
    at_risk_open: int
    avg_schedule_slip_bdays: float
    cycle_time_p50_bdays: float
    cycle_time_p90_bdays: float
    rework_rate_pct: float
    throughput_last_weeks: list[WeekCountResponse]


class BurnupResponse(BaseModelConfig):
    window_start: str
    window_end: str
    total_scope: int
    points: list[SeriesPointResponse]


class MemberLoadResponse(BaseModelConfig):
    user_id: UUID
    name: str
    open_count: int


class TeamPerformanceResponse(BaseModelConfig):
    team_id: UUID
    team_name: str
    assigned: int
    completed: int
    open: int
    overdue: int
    cycle_time_bdays: float
    review_time_bdays: float
    rework_rate_pct: float
    open_per_member: list[MemberLoadResponse]


class PersonPerformanceResponse(BaseModelConfig):
    user_id: UUID
    name: str
    completed: int
    open_count: int
    cycle_time_bdays: float
    on_time_pct: float
    returns_received: int
    logged_days: float


class DeliveryLapseResponse(BaseModelConfig):
    task_id: UUID
    task_title: str
    element_path: list[str]
    versions: int
    production_bdays: int
    review_bdays: int
    total_bdays: int


class TaskRowResponse(BaseModelConfig):
    task_id: UUID
    title: str
    element_path: list[str]
    responsable: str | None = None
    equipo: str | None = None
    estado: str
    prioridad: str
    start_date: str | None = None
    due_date: str | None = None
    completed_date: str | None = None
    slip_bdays: int | None = None
    returns: int
    versions: int


class ProjectAnalyticsResponse(BaseModelConfig):
    project_id: UUID
    project_name: str
    generated_at: str
    filters: dict[str, str | None]
    overview: OverviewResponse
    burnup: BurnupResponse
    by_team: list[TeamPerformanceResponse]
    by_person: list[PersonPerformanceResponse]
    delivery_lapses: list[DeliveryLapseResponse]
    tasks: list[TaskRowResponse]
