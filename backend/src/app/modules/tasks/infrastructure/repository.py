from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.shared.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session):
        super().__init__(session=session, model=Task)

    async def get_by_work_item(self, work_item_id: UUID) -> list[Task]:
        query = (
            select(Task)
            .where(Task.work_item_id == work_item_id, Task.deleted_at.is_(None))
            .order_by(Task.created_at)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_all_by_project(self, project_id: UUID) -> list[Task]:
        """Todas las tareas del proyecto, vía su WorkItem."""
        query = (
            select(Task)
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .where(
                Task.deleted_at.is_(None),
                WorkItem.proyecto_id == project_id,
                WorkItem.deleted_at.is_(None),
            )
            .order_by(Task.start_date)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_dependencies(self, task_id: UUID) -> list[TaskDependency]:
        query = (
            select(TaskDependency)
            .where(TaskDependency.task_id == task_id)
            .options(selectinload(TaskDependency.depends_on))
        )
        return list((await self._session.execute(query)).scalars().all())

    async def add_dependency(self, dependency: TaskDependency) -> TaskDependency:
        self._session.add(dependency)
        await self._session.flush()
        await self._session.refresh(dependency)
        return dependency

    async def dependency_exists(self, task_id: UUID, depends_on_id: UUID) -> bool:
        query = select(TaskDependency.id).where(
            TaskDependency.task_id == task_id,
            TaskDependency.depends_on_id == depends_on_id,
        )
        return (await self._session.execute(query)).first() is not None
