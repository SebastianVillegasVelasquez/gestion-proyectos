from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.modules.project.infrastructure.models import Phase, ProjectNode
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.shared.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session):
        super().__init__(session=session, model=Task)

    async def get_by_node_id(self, node_id: UUID) -> list[Task]:
        query = (
            select(Task)
            .where(Task.node_id == node_id, Task.deleted_at.is_(None))
            .order_by(Task.created_at)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_dependencies(self, task_id: UUID) -> list[TaskDependency]:
        query = (
            select(TaskDependency)
            .where(TaskDependency.task_id == task_id)
            .options(selectinload(TaskDependency.depends_on))
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

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
        result = await self._session.execute(query)
        return result.first() is not None

    async def get_all_by_project(self, project_id: UUID) -> list[Task]:
        """Todas las tareas del proyecto: las que cuelgan de un nodo del proyecto
        y las que cuelgan directamente de una fase del proyecto."""
        node_ids = select(ProjectNode.id).where(ProjectNode.project_id == project_id)
        phase_ids = select(Phase.id).where(Phase.project_id == project_id)
        query = (
            select(Task)
            .where(
                Task.deleted_at.is_(None),
                or_(Task.node_id.in_(node_ids), Task.phase_id.in_(phase_ids)),
            )
            .order_by(Task.start_date)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_tasks_in_earlier_phases(
        self, project_id: UUID, phase_order: int
    ) -> list[Task]:
        """Tareas que cuelgan de fases con order_index menor en el mismo proyecto."""
        query = (
            select(Task)
            .join(ProjectNode, Task.node_id == ProjectNode.id)
            .join(Phase, ProjectNode.phase_id == Phase.id)
            .where(
                Phase.project_id == project_id,
                Phase.order_index < phase_order,
                Task.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())
