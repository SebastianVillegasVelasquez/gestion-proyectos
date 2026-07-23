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

    async def get_by_team(self, team_id: UUID) -> list[tuple]:
        """Tareas delegadas a un equipo, con nombre de módulo, proyecto y responsable.

        Read model del workspace: devuelve filas
        (Task, work_item_name, project_id, project_name, assignee_name) para
        agrupar por módulo sin pedir el árbol del proyecto. LEFT JOIN al usuario
        porque el responsable es opcional (tarea aún sin asignar).
        """
        from app.modules.identity.infrastructure.models import User
        from app.modules.project.infrastructure.models import Project
        from sqlalchemy import func

        query = (
            select(
                Task,
                WorkItem.nombre.label("work_item_name"),
                Project.id.label("project_id"),
                Project.name.label("project_name"),
                func.concat(User.name, " ", User.last_name).label("assignee_name"),
            )
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, WorkItem.proyecto_id == Project.id)
            .outerjoin(User, Task.assignee_id == User.id)
            .where(Task.team_id == team_id, Task.deleted_at.is_(None))
            .order_by(WorkItem.orden, Task.start_date)
        )
        # tuple(row) para exponer filas posicionales (la use case las desempaqueta).
        return [tuple(r) for r in (await self._session.execute(query)).all()]

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
