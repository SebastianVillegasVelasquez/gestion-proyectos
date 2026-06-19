from uuid import UUID

from sqlalchemy import String, and_, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.collaborators.domain.models import (
    CollaboratorCounts,
    CollaboratorHistoryRead,
    CollaboratorIdentity,
    CollaboratorRow,
    CollaboratorTaskRead,
)
from app.modules.collaborators.domain.repository import CollaboratorRepository
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.infrastructure.models import TeamMember

_STATUS = cast(Task.status, String)
_COMPLETED = TaskStatus.COMPLETADA.name
_IN_PROGRESS = TaskStatus.EN_PROGRESO.name


class SqlAlchemyCollaboratorRepository(CollaboratorRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _active_user_conditions(self, search: str | None) -> list:
        conditions = [User.is_active.is_(True), User.deleted_at.is_(None)]
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                )
            )
        return conditions

    async def count_collaborators(self, search: str | None) -> int:
        total = await self._session.scalar(
            select(func.count())
            .select_from(User)
            .where(*self._active_user_conditions(search))
        )
        return int(total or 0)

    async def list_collaborator_rows(
        self, search: str | None, limit: int, offset: int
    ) -> list[CollaboratorRow]:
        completed = func.coalesce(
            func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
        )
        rows = (
            await self._session.execute(
                select(
                    User.id,
                    User.name,
                    User.last_name,
                    User.position,
                    func.count(Task.id).label("assigned"),
                    completed.label("completed"),
                )
                .outerjoin(
                    Task,
                    and_(Task.assignee_id == User.id, Task.deleted_at.is_(None)),
                )
                .where(*self._active_user_conditions(search))
                .group_by(User.id)
                .order_by(User.name, User.last_name)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return [
            CollaboratorRow(
                user_id=row.id,
                name=row.name,
                last_name=row.last_name,
                position=row.position,
                assigned_tasks=int(row.assigned or 0),
                completed_tasks=int(row.completed or 0),
            )
            for row in rows
        ]

    async def get_identity(self, user_id: UUID) -> CollaboratorIdentity | None:
        user = await self._session.get(User, user_id)
        if user is None or user.is_deleted:
            return None
        return CollaboratorIdentity(
            user_id=user.id,
            name=user.name,
            last_name=user.last_name,
            email=user.email,
            position=user.position,
        )

    async def get_status_counts(self, user_id: UUID) -> CollaboratorCounts:
        row = (
            await self._session.execute(
                select(
                    func.count(Task.id).label("assigned"),
                    func.coalesce(
                        func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                    func.coalesce(
                        func.sum(case((_STATUS == _IN_PROGRESS, 1), else_=0)), 0
                    ).label("in_progress"),
                ).where(Task.deleted_at.is_(None), Task.assignee_id == user_id)
            )
        ).one()
        return CollaboratorCounts(
            assigned=int(row.assigned or 0),
            completed=int(row.completed or 0),
            in_progress=int(row.in_progress or 0),
        )

    async def count_projects(self, user_id: UUID) -> int:
        total = await self._session.scalar(
            select(func.count(func.distinct(ProjectMember.project_id))).where(
                ProjectMember.user_id == user_id,
                ProjectMember.deleted_at.is_(None),
            )
        )
        return int(total or 0)

    async def count_teams(self, user_id: UUID) -> int:
        total = await self._session.scalar(
            select(func.count(TeamMember.id)).where(TeamMember.user_id == user_id)
        )
        return int(total or 0)

    async def list_assigned_tasks(
        self, user_id: UUID, limit: int
    ) -> list[CollaboratorTaskRead]:
        tasks = (
            (
                await self._session.execute(
                    select(Task)
                    .where(Task.deleted_at.is_(None), Task.assignee_id == user_id)
                    .order_by(Task.due_date.asc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            CollaboratorTaskRead(
                id=task.id,
                title=task.title,
                status=task.status,
                due_date=task.due_date,
                completed_at=task.completed_at,
            )
            for task in tasks
        ]

    async def list_history(
        self, user_id: UUID, limit: int
    ) -> list[CollaboratorHistoryRead]:
        rows = (
            await self._session.execute(
                select(TaskHistory, Task.title)
                .join(Task, TaskHistory.task_id == Task.id)
                .where(TaskHistory.changed_by_id == user_id)
                .order_by(TaskHistory.created_at.desc())
                .limit(limit)
            )
        ).all()
        return [
            CollaboratorHistoryRead(
                id=entry.id,
                task_id=entry.task_id,
                task_title=title,
                action=entry.action,
                old_status=entry.old_status,
                new_status=entry.new_status,
                change_reason=entry.change_reason,
                created_at=entry.created_at,
            )
            for entry, title in rows
        ]
