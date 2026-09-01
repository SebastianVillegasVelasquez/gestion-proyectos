from decimal import Decimal
from typing import Sequence
from uuid import UUID

from sqlalchemy import Row, delete, func, select
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
from app.modules.tasks.domain import rules
from app.modules.teams.infrastructure.models import Team
from app.shared.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session):
        super().__init__(session=session, model=Task)

    async def get_by_work_item(self, work_item_id: UUID) -> list[Task]:
        query = (
            select(Task)
            .where(Task.work_item_id == work_item_id, Task.deleted_at.is_(None))
            .options(selectinload(Task.assignee))
            .order_by(Task.orden, Task.created_at)
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
        """Todas las tareas del proyecto: adjuntas a un elemento o sueltas.

        Ordenadas por `orden` (la prioridad / orden de cumplimiento que se fija
        a mano) y, a igualdad, por antigüedad. El agrupado por elemento y por
        tarea padre lo hace la vista; aquí basta con que el orden entre
        hermanas sea estable y respete lo que el usuario colocó.
        """
        query = (
            select(Task)
            .where(Task.deleted_at.is_(None), Task.project_id == project_id)
            .options(selectinload(Task.assignee))
            .order_by(Task.orden, Task.created_at)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_siblings_in_order(self, task: Task) -> list[Task]:
        """Las tareas hermanas de `task` (ella incluida), en su orden actual.

        Hermanas = mismo proyecto, mismo elemento (`work_item_id`) y misma
        tarea padre (`parent_task_id`), contando NULL como un valor más. Es el
        conjunto sobre el que opera el reordenamiento.
        """
        query = (
            select(Task)
            .where(
                Task.deleted_at.is_(None),
                Task.project_id == task.project_id,
                Task.work_item_id.is_not_distinct_from(task.work_item_id),
                Task.parent_task_id.is_not_distinct_from(task.parent_task_id),
            )
            .order_by(Task.orden, Task.created_at)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def renumber(self, tasks_in_order: list[Task]) -> None:
        """Reescribe `orden` = 0, 1, 2… siguiendo la lista dada, en la misma
        transacción. Renumerar todo el grupo (en vez de parchear una fila)
        evita huecos y empates tras arrastres repetidos."""
        for index, task in enumerate(tasks_in_order):
            task.orden = index
            self._session.add(task)
        await self._session.flush()

    async def get_representing_task(self, work_item_id: UUID) -> Task | None:
        """La tarea viva que ES este elemento (`represents_work_item`), o None.

        Como mucho hay una (índice único parcial). Es la que se muestra "en la
        fila del elemento" en vez de como una tarea hija más."""
        query = select(Task).where(
            Task.work_item_id == work_item_id,
            Task.represents_work_item.is_(True),
            Task.deleted_at.is_(None),
        )
        return (await self._session.execute(query)).scalars().first()

    async def get_subtasks(self, parent_task_id: UUID) -> list[Task]:
        """Subtareas vivas de una tarea, para el borrado en cascada."""
        query = select(Task).where(
            Task.parent_task_id == parent_task_id, Task.deleted_at.is_(None)
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

    async def logged_days(self, task_id: UUID) -> Decimal:
        total = await self._session.scalar(
            select(func.coalesce(func.sum(TaskTimeEntry.days), 0)).where(
                TaskTimeEntry.task_id == task_id
            )
        )
        return Decimal(total or 0)

    async def logged_days_by_task(self, task_ids: list[UUID]) -> dict[UUID, Decimal]:
        """Días dedicados de VARIAS tareas en una sola consulta.

        Las listas de tareas muestran "3 / 8 d" en cada fila; pedir la suma
        tarea a tarea sería una consulta por fila (N+1).
        """
        if not task_ids:
            return {}
        rows = (
            await self._session.execute(
                select(TaskTimeEntry.task_id, func.sum(TaskTimeEntry.days))
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
                # NULLIF + TRIM: con LEFT JOIN sin responsable, concat() de
                # Postgres trata NULL como cadena vacia y devolveria " " (un
                # espacio), no NULL. La UI hace `assignee_name ?? "Sin
                # responsable"`, asi que ese espacio se colaba como un nombre
                # en blanco. Normalizamos en el origen: sin responsable, NULL.
                func.nullif(
                    func.trim(func.concat(User.name, " ", User.last_name)), ""
                ).label("assignee_name"),
            )
            .outerjoin(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, Task.project_id == Project.id)
            .outerjoin(User, Task.assignee_id == User.id)
            .where(Task.team_id == team_id, Task.deleted_at.is_(None))
            .order_by(Task.start_date)
        )
        # tuple(row) para exponer filas posicionales (la use case las desempaqueta).
        return [tuple(r) for r in (await self._session.execute(query)).all()]

    async def get_assigned_to_user(self, user_id: UUID) -> list[tuple]:
        """Todas las tareas VIVAS cuyo responsable es `user_id`, en cualquier
        proyecto: es "Mis tareas". Trae ya resueltos el nombre del elemento, del
        proyecto y del equipo (si la tarea es de uno), para la lista sin N+1.
        """
        from app.modules.project.infrastructure.models import Project

        query = (
            select(
                Task,
                WorkItem.nombre.label("work_item_name"),
                Project.name.label("project_name"),
                Team.name.label("team_name"),
            )
            .outerjoin(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, Task.project_id == Project.id)
            .outerjoin(Team, Task.team_id == Team.id)
            .where(Task.assignee_id == user_id, Task.deleted_at.is_(None))
            .order_by(Task.due_date.is_(None), Task.due_date, Task.start_date)
        )
        return [tuple(r) for r in (await self._session.execute(query)).all()]

    # El predecesor puede ser una tarea o un elemento del árbol; para saber si
    # ese elemento cuenta como "entregado" hay que mirar su tipo (que tiene
    # lazy="raise"), así que se trae por adelantado con la dependencia.
    _DEP_LOADS = (
        selectinload(TaskDependency.depends_on),
        selectinload(TaskDependency.depends_on_work_item).selectinload(WorkItem.tipo),
    )

    async def get_dependencies(self, task_id: UUID) -> list[TaskDependency]:
        query = (
            select(TaskDependency)
            .where(TaskDependency.task_id == task_id)
            .options(*self._DEP_LOADS)
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
            .options(*self._DEP_LOADS)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_dependencies_by_team(self, team_id: UUID) -> list[TaskDependency]:
        """Dependencias FtS de las tareas delegadas a un equipo, en UNA consulta.

        El workspace pinta "Bloqueada por: <tarea>" en cada fila; pedir las
        dependencias tarea por tarea sería un N+1. `selectinload(depends_on)`
        trae el título de la tarea bloqueante sin una consulta extra por fila.
        """
        query = (
            select(TaskDependency)
            .join(Task, TaskDependency.task_id == Task.id)
            .where(Task.team_id == team_id, Task.deleted_at.is_(None))
            .options(*self._DEP_LOADS)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_dependencies_by_tasks(
        self, task_ids: Sequence[UUID]
    ) -> list[TaskDependency]:
        """Dependencias FtS de un lote de tareas, en UNA consulta. Igual que
        `get_dependencies_by_team` pero por ids explícitos: lo usa «Mis tareas»
        para pintar el bloqueo/etiqueta sin un N+1 por fila."""
        if not task_ids:
            return []
        query = (
            select(TaskDependency)
            .where(TaskDependency.task_id.in_(list(task_ids)))
            .options(*self._DEP_LOADS)
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_work_item(self, work_item_id: UUID):
        """El WorkItem (con su tipo) o None. Para validar una dependencia
        tarea→elemento sin arrastrar el repositorio del árbol."""
        query = (
            select(WorkItem)
            .where(WorkItem.id == work_item_id)
            .options(selectinload(WorkItem.tipo))
        )
        return (await self._session.execute(query)).scalars().first()

    async def has_undelivered_third_party_ancestor(self, work_item_id: UUID) -> bool:
        """¿Algún ancestro de `work_item_id` (él incluido) es una «actividad de
        terceros» que todavía NO se marcó como entregada (sin fecha real)?

        Es la compuerta automática: mientras el tercero no entregue, nada de lo
        que cuelga de él puede avanzar, sin necesidad de una dependencia FtS
        explícita. Sube por `parent_id`; los árboles son poco profundos.
        """
        seen: set[UUID] = set()
        current: UUID | None = work_item_id
        while current is not None and current not in seen:
            seen.add(current)
            item = await self.get_work_item(current)
            if item is None:
                break
            is_third_party = rules.is_third_party_tipo(getattr(item, "tipo", None))
            if is_third_party and (
                item.fecha_fin_real is None and item.fecha_inicio_real is None
            ):
                return True
            current = item.parent_id
        return False

    async def get_dependents(self, task_id: UUID) -> list[Task]:
        """Las tareas VIVAS que dependen (FtS) de `task_id`: al completarla,
        su fecha de inicio se recalcula en cascada."""
        query = (
            select(Task)
            .join(TaskDependency, TaskDependency.task_id == Task.id)
            .where(
                TaskDependency.depends_on_id == task_id,
                Task.deleted_at.is_(None),
            )
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get_dependents_of_work_item(self, work_item_id: UUID) -> list[Task]:
        """Las tareas VIVAS que dependen (FtS) de un elemento del árbol
        (típico: una «actividad de terceros»): al marcarla como entregada,
        arrancan en su fecha."""
        query = (
            select(Task)
            .join(TaskDependency, TaskDependency.task_id == Task.id)
            .where(
                TaskDependency.depends_on_work_item_id == work_item_id,
                Task.deleted_at.is_(None),
            )
        )
        return list((await self._session.execute(query)).scalars().all())

    async def add_dependency(self, dependency: TaskDependency) -> TaskDependency:
        self._session.add(dependency)
        await self._session.flush()
        await self._session.refresh(dependency)
        return dependency

    async def dependency_exists(
        self,
        task_id: UUID,
        depends_on_id: UUID | None = None,
        depends_on_work_item_id: UUID | None = None,
    ) -> bool:
        target = (
            TaskDependency.depends_on_id == depends_on_id
            if depends_on_id is not None
            else TaskDependency.depends_on_work_item_id == depends_on_work_item_id
        )
        query = select(TaskDependency.id).where(
            TaskDependency.task_id == task_id, target
        )
        return (await self._session.execute(query)).first() is not None

    async def delete_dependency(
        self,
        task_id: UUID,
        depends_on_id: UUID | None = None,
        depends_on_work_item_id: UUID | None = None,
    ) -> bool:
        """Borra la arista FtS (borrado físico: la tabla no tiene soft-delete).

        Devuelve True si se borró alguna fila, False si no existía.
        """
        target = (
            TaskDependency.depends_on_id == depends_on_id
            if depends_on_id is not None
            else TaskDependency.depends_on_work_item_id == depends_on_work_item_id
        )
        result = await self._session.execute(
            delete(TaskDependency).where(TaskDependency.task_id == task_id, target)
        )
        await self._session.flush()
        return bool(getattr(result, "rowcount", 0))
