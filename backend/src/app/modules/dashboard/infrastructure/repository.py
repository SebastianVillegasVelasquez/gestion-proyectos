import datetime
from abc import ABC, abstractmethod
from dataclasses import dataclass

from sqlalchemy import String, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.project.infrastructure.models import Project
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


@dataclass
class DashboardSummary:
    active_projects: int
    total_tasks: int
    completed_tasks: int
    in_review_tasks: int
    overdue_tasks: int


class DashboardRepository(ABC):
    @abstractmethod
    async def get_summary(self) -> DashboardSummary: ...


class SqlAlchemyDashboardRepository(DashboardRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_summary(self) -> DashboardSummary:
        today = datetime.date.today()

        # We compare the status column as a plain string to avoid Postgres
        # casting parameters to a `task_status` enum type that may not exist
        # in environments where the column is stored as VARCHAR.
        status_str = cast(Task.status, String)
        completed = TaskStatus.COMPLETADA.name
        in_review = TaskStatus.EN_REVISION.name
        cancelled = TaskStatus.CANCELADA.name

        tasks_query = select(
            func.count(Task.id).label("total"),
            func.coalesce(
                func.sum(case((status_str == completed, 1), else_=0)), 0
            ).label("completed"),
            func.coalesce(
                func.sum(case((status_str == in_review, 1), else_=0)), 0
            ).label("in_review"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Task.due_date < today,
                                status_str.notin_([completed, cancelled]),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Task.deleted_at.is_(None))

        projects_query = select(func.count(Project.id)).where(
            Project.deleted_at.is_(None)
        )

        task_row = (await self._session.execute(tasks_query)).one()
        projects_count = (await self._session.execute(projects_query)).scalar_one()

        return DashboardSummary(
            active_projects=int(projects_count or 0),
            total_tasks=int(task_row.total or 0),
            completed_tasks=int(task_row.completed or 0),
            in_review_tasks=int(task_row.in_review or 0),
            overdue_tasks=int(task_row.overdue or 0),
        )
