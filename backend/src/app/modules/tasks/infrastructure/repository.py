from decimal import Decimal
from typing import Sequence
from uuid import UUID

from sqlalchemy import Row, func, select
from sqlalchemy.orm import selectinload

from app.modules.identity.infrastructure.models import User
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.models import (
    Task,
    TaskComment,
    TaskDependency,
    TaskHistory,
    TaskTimeEntry,
)
from app.modules.teams.infrastructure.models import Team
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

    async def work_items_with_tasks(self, work_item_ids: list[UUID]) -> set[UUID]:
        """De los elementos dados, cuáles ya tienen alguna tarea viva.

        Una sola consulta para toda la rama: la carga masiva necesita saberlo de
        cientos de piezas a la vez, y preguntarlo una por una era el cuello de
        botella de la operación.
        """
        if not work_item_ids:
            return set()
        rows = await self._session.execute(
            select(Task.work_item_id)
            .where(Task.work_item_id.in_(work_item_ids), Task.deleted_at.is_(None))
            .distinct()
        )
        return {row[0] for row in rows.all()}

    async def get_all_by_project(self, project_id: UUID) -> list[Task]:
        """Todas las tareas del proyecto: adjuntas a un elemento o sueltas."""
        query = (
            select(Task)
            .where(Task.deleted_at.is_(None), Task.project_id == project_id)
            .order_by(Task.start_date)
        )
        return list((await self._session.execute(query)).scalars().all())

    # ── Comentarios ───────────────────────────────────────────────────────────
    async def add_comment(self, comment: TaskComment) -> TaskComment:
        self._session.add(comment)
        await self._session.flush()
        await self._session.refresh(comment)
        return comment

    async def get_comment(self, comment_id: UUID) -> TaskComment | None:
        return await self._session.get(TaskComment, comment_id)

    async def get_comments(self, task_id: UUID) -> Sequence[Row]:
        """Comentarios de una tarea (los vivos), del más antiguo al más nuevo:
        una conversación se lee en el orden en que ocurrió."""
        query = (
            select(TaskComment, User.name, User.last_name)
            .join(User, TaskComment.author_id == User.id)
            .where(TaskComment.task_id == task_id, TaskComment.deleted_at.is_(None))
            .options(selectinload(TaskComment.mentions))
            .order_by(TaskComment.created_at)
        )
        return (await self._session.execute(query)).all()

    # ── Registro de esfuerzo ──────────────────────────────────────────────────
    async def add_time_entry(self, entry: TaskTimeEntry) -> TaskTimeEntry:
        self._session.add(entry)
        await self._session.flush()
        await self._session.refresh(entry)
        return entry

    async def get_time_entry(self, entry_id: UUID) -> TaskTimeEntry | None:
        return await self._session.get(TaskTimeEntry, entry_id)

    async def delete_time_entry(self, entry: TaskTimeEntry) -> None:
        # Borrado real: un apunte de horas equivocado no se archiva, se corrige.
        await self._session.delete(entry)
        await self._session.flush()

    async def get_time_entries(self, task_id: UUID) -> Sequence[Row]:
        """Apuntes de una tarea con el nombre de quien los hizo, del más
        reciente al más antiguo."""
        query = (
            select(TaskTimeEntry, User.name, User.last_name)
            .join(User, TaskTimeEntry.user_id == User.id)
            .where(TaskTimeEntry.task_id == task_id)
            .order_by(TaskTimeEntry.work_date.desc(), TaskTimeEntry.created_at.desc())
        )
        return (await self._session.execute(query)).all()

    async def logged_hours(self, task_id: UUID) -> Decimal:
        total = await self._session.scalar(
            select(func.coalesce(func.sum(TaskTimeEntry.hours), 0)).where(
                TaskTimeEntry.task_id == task_id
            )
        )
        return Decimal(total or 0)

    async def logged_hours_by_task(self, task_ids: list[UUID]) -> dict[UUID, Decimal]:
        """Horas dedicadas de VARIAS tareas en una sola consulta.

        Las listas de tareas muestran "3 / 8 h" en cada fila; pedir la suma
        tarea a tarea sería una consulta por fila (N+1).
        """
        if not task_ids:
            return {}
        rows = (
            await self._session.execute(
                select(TaskTimeEntry.task_id, func.sum(TaskTimeEntry.hours))
                .where(TaskTimeEntry.task_id.in_(task_ids))
                .group_by(TaskTimeEntry.task_id)
            )
        ).all()
        return {task_id: Decimal(total or 0) for task_id, total in rows}

    # ── Historial (trazabilidad) ──────────────────────────────────────────────
    async def add_history(self, entry: TaskHistory) -> TaskHistory:
        """Guarda un evento del historial dentro de la MISMA transacción que el
        cambio que lo provocó: o quedan los dos, o no queda ninguno. Un
        historial que puede desincronizarse del hecho que narra no sirve para
        auditar."""
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def user_label(self, user_id: UUID) -> str:
        row = (
            await self._session.execute(
                select(User.name, User.last_name).where(User.id == user_id)
            )
        ).first()
        return f"{row[0]} {row[1]}".strip() if row else "Usuario eliminado"

    async def team_label(self, team_id: UUID) -> str:
        name = await self._session.scalar(select(Team.name).where(Team.id == team_id))
        return name or "Equipo eliminado"

    async def work_item_label(self, work_item_id: UUID) -> str:
        name = await self._session.scalar(
            select(WorkItem.nombre).where(WorkItem.id == work_item_id)
        )
        return name or "Elemento eliminado"

    async def set_work_item(self, task: Task, work_item_id: UUID | None) -> Task:
        """Adjunta/desadjunta la tarea de un elemento. `None` = tarea suelta."""
        task.work_item_id = work_item_id
        self._session.add(task)
        await self._session.flush()
        await self._session.refresh(task)
        return task

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
            .outerjoin(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, Task.project_id == Project.id)
            .outerjoin(User, Task.assignee_id == User.id)
            .where(Task.team_id == team_id, Task.deleted_at.is_(None))
            .order_by(Task.start_date)
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

    async def get_dependencies_by_project(
        self, project_id: UUID
    ) -> list[TaskDependency]:
        """Todas las dependencias cuyas tareas dependientes son del proyecto.

        Sirve al cronograma para dibujar las flechas FtS de todo el proyecto en
        una sola llamada (en vez de una por tarea).
        """
        query = (
            select(TaskDependency)
            .join(Task, TaskDependency.task_id == Task.id)
            .where(Task.project_id == project_id, Task.deleted_at.is_(None))
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
