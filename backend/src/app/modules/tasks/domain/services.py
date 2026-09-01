from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from app.modules.tasks.domain import rules
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskDependencyResponse,
    TaskResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.shared.exceptions import (
    ConflictError,
    CyclicDependencyError,
    NotFoundError,
    ValidationError,
)
from app.shared.graph import would_create_cycle


# Avance por estado de una tarea SIN subtareas. Misma escala que el frontend
# (`team-tasks.ts` y `gantt/metrics.ts`): si difirieran, la misma tarea se
# vería con dos porcentajes distintos según la pantalla.
_STATUS_PROGRESS: dict[TaskStatus, int] = {
    TaskStatus.PENDIENTE_POR_INICIAR: 0,
    TaskStatus.EN_PROGRESO: 35,
    TaskStatus.EN_REVISION: 70,
    TaskStatus.DEVUELTA: 50,
    TaskStatus.COMPLETADA: 100,
    TaskStatus.CANCELADA: 0,
}


def compute_task_progress(
    status: TaskStatus,
    requires_approval: bool,
    child_pcts: list[int] | None = None,
) -> int:
    """Avance (0-100) de una tarea.

    - Con subtareas: es el promedio del avance de sus subtareas (cada objetivo
      específico pesa lo mismo). Una tarea padre es un ENTREGABLE, así que no
      llega a 100 mientras necesite aprobación y no esté COMPLETADA: entregar el
      resultado es el último paso, no la suma de las subtareas.
    - Sin subtareas (incluidas las propias subtareas): por estado.
    """
    if child_pcts:
        avg = round(sum(child_pcts) / len(child_pcts))
        if avg >= 100 and requires_approval and status != TaskStatus.COMPLETADA:
            return 99
        return min(avg, 100)
    return _STATUS_PROGRESS.get(status, 0)


def progress_by_id(tasks) -> dict[UUID, int]:
    """Avance por id para una lista PLANA de tareas (padres + subtareas juntos),
    haciendo el rollup de las hojas hacia arriba. Cada objeto necesita `.id`,
    `.parent_task_id`, `.status` y `.requires_approval`.

    Lo usa la vista de equipo, que sí trae padre e hijas en la misma respuesta.
    """
    children: dict[UUID, list] = {}
    by_id = {}
    for t in tasks:
        by_id[t.id] = t
        if t.parent_task_id is not None:
            children.setdefault(t.parent_task_id, []).append(t)

    out: dict[UUID, int] = {}

    def resolve(node) -> int:
        if node.id in out:
            return out[node.id]
        kids = children.get(node.id)
        status = node.status or TaskStatus.PENDIENTE_POR_INICIAR
        if kids:
            pct = compute_task_progress(
                status, node.requires_approval, [resolve(k) for k in kids]
            )
        else:
            pct = compute_task_progress(status, node.requires_approval)
        out[node.id] = pct
        return pct

    for t in tasks:
        resolve(t)
    return out


def _estimate_in_days(value) -> int:
    """Días estimados → nº entero de días de calendario (mínimo 1 si hay
    estimación). El motor de fechas de la estructura también trabaja en días
    enteros, así que la tarea hace lo mismo."""
    try:
        days = round(float(value))
    except (TypeError, ValueError):
        return 0
    return max(1, days)


def reschedule_task_start(
    task: "Task",
    new_start: date,
    *,
    recompute_due_from_estimate: bool = False,
) -> bool:
    """Mueve el inicio de `task` a `new_start` y recalcula su fin. Devuelve True
    si cambió algo. Es la pieza de la "cascada de fechas": cuando un predecesor
    se completa/entrega, sus dependientes arrancan en la fecha nueva.

    - Si la tarea ya tenía inicio Y fin, se conserva la duración (el fin se
      desplaza el mismo delta).
    - Si NO tenía fin pero sí `estimated_days`, el fin sale de ahí:
      `fin = nuevo inicio + días estimados`.

    `recompute_due_from_estimate` (solo lo pasan las cascadas de dependencias):
    cuando la tarea tiene `estimated_days`, el fin SIEMPRE se recalcula como
    `nuevo inicio + días estimados`, aunque ya tuviera un fin fijado a mano. Es
    lo que se espera de una dependencia FtS sobre una «actividad de terceros» u
    otra tarea: al abrirse la compuerta, la dependiente arranca en la fecha de
    entrega y dura lo estimado. Sin el flag (p. ej. arrastre de barra en el
    Gantt vía `UpdateTaskUseCase`) se mantiene el desplazamiento por delta.
    """
    changed = False
    if task.start_date != new_start:
        if task.start_date is not None and task.due_date is not None:
            task.due_date = task.due_date + (new_start - task.start_date)
        task.start_date = new_start
        changed = True

    est = _estimate_in_days(getattr(task, "estimated_days", None))
    if est > 0 and (recompute_due_from_estimate or task.due_date is None):
        new_due = new_start + timedelta(days=est)
        if task.due_date != new_due:
            task.due_date = new_due
            changed = True

    return changed


class TaskService:
    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_task(self, data: "CreateTaskRequest") -> "TaskResponse":
        payload = data.model_dump(exclude_none=True)
        # Campos del request que NO son columnas del modelo.
        for field in ("duration_days", "depends_on_id", "depends_on_work_item_id"):
            payload.pop(field, None)
        return self._to_response(await self.repo.add(Task(**payload)))

    async def get_task_by_id(self, task_id: UUID) -> "TaskResponse":
        task = await self._get_active(task_id)
        resp = self._to_response(task, await self.repo.logged_days(task_id))
        resp.depends_on_third_party = any(
            d.depends_on_work_item_id is not None
            and rules.is_third_party_tipo(getattr(d.depends_on_work_item, "tipo", None))
            for d in await self.repo.get_dependencies(task_id)
        )
        # Con subtareas, el avance es el promedio del suyo (el `_to_response`
        # solo sabe el del estado). Un nivel: las subtareas anidadas cuentan por
        # estado, que es su avance real como hojas.
        subtasks = await self.repo.get_subtasks(task_id)
        if subtasks:
            resp.progress_pct = compute_task_progress(
                resp.status,
                resp.requires_approval,
                [
                    compute_task_progress(
                        s.status or TaskStatus.PENDIENTE_POR_INICIAR,
                        s.requires_approval,
                    )
                    for s in subtasks
                    if not s.is_deleted
                ],
            )
        return resp

    async def get_tasks_by_work_item(self, work_item_id: UUID) -> list["TaskResponse"]:
        return await self._with_logged_days(
            await self.repo.get_by_work_item(work_item_id)
        )

    async def get_tasks_by_project(self, project_id: UUID) -> list["TaskResponse"]:
        return await self._with_logged_days(
            await self.repo.get_all_by_project(project_id)
        )

    async def _with_logged_days(self, tasks: list[Task]) -> list["TaskResponse"]:
        """Añade a cada tarea su dedicación con UNA consulta agregada.

        Preguntarla tarea a tarea sería una consulta por fila (N+1), y estas
        listas se pintan enteras en el cronograma y en el tablero.
        """
        task_ids = [t.id for t in tasks]
        totals = await self.repo.logged_days_by_task(task_ids)
        # Una consulta para todas las dependencias FtS de la lista: marca qué
        # tareas dependen de una «actividad de terceros».
        third_party = {
            dep.task_id
            for dep in await self.repo.get_dependencies_by_tasks(task_ids)
            if dep.depends_on_work_item_id is not None
            and rules.is_third_party_tipo(
                getattr(dep.depends_on_work_item, "tipo", None)
            )
        }
        responses = [
            self._to_response(
                t,
                totals.get(t.id, Decimal("0")),
                depends_on_third_party=t.id in third_party,
            )
            for t in tasks
        ]
        self._rollup_estimates(responses)
        self._rollup_progress(responses)
        return responses

    @staticmethod
    def _rollup_progress(responses: list["TaskResponse"]) -> None:
        """El avance de una tarea con subtareas es el promedio del de sus
        subtareas (recursivo, de las hojas hacia arriba). Una tarea sin
        subtareas conserva el avance por estado que ya trae.
        """
        children: dict[UUID, list["TaskResponse"]] = {}
        for r in responses:
            if r.parent_task_id is not None:
                children.setdefault(r.parent_task_id, []).append(r)
        if not children:
            return

        def resolve(node: "TaskResponse") -> int:
            kids = children.get(node.id)
            node.progress_pct = compute_task_progress(
                node.status,
                node.requires_approval,
                [resolve(k) for k in kids] if kids else None,
            )
            return node.progress_pct

        by_id = {r.id: r for r in responses}
        for r in responses:
            if r.parent_task_id is None or r.parent_task_id not in by_id:
                resolve(r)

    @staticmethod
    def _rollup_estimates(responses: list["TaskResponse"]) -> None:
        """El estimado de una tarea con subtareas es, EN TEORÍA, el total de las
        suyas: si el padre no tiene un estimado propio, se rellena con la suma
        de los estimados de sus subtareas (recursivo, de las hojas hacia arriba).
        Un estimado propio del padre se respeta y no se pisa.
        """
        children: dict[UUID, list["TaskResponse"]] = {}
        for r in responses:
            if r.parent_task_id is not None:
                children.setdefault(r.parent_task_id, []).append(r)
        if not children:
            return

        by_id = {r.id: r for r in responses}

        def resolve(node: "TaskResponse") -> Decimal | None:
            kids = children.get(node.id)
            if kids:
                parts = [resolve(k) for k in kids]
                total = sum((p for p in parts if p is not None), Decimal("0"))
                if node.estimated_days is None and any(p is not None for p in parts):
                    node.estimated_days = total
            return node.estimated_days

        for r in responses:
            if r.parent_task_id is None or r.parent_task_id not in by_id:
                resolve(r)

    # Campos de la tarea que se pueden dejar EN BLANCO desde un PATCH (enviando
    # `null` explícito): quitar el responsable / el equipo, borrar una fecha,
    # dejar de estimar días, vaciar la descripción. El resto (`title`,
    # `priority`) nunca se limpia a null, así que un `null` en ellos se ignora.
    _NULLABLE_UPDATE_FIELDS = {
        "description",
        "assignee_id",
        "team_id",
        "start_date",
        "due_date",
        "estimated_days",
    }

    async def update_task(
        self, task_id: UUID, data: "UpdateTaskRequest"
    ) -> "TaskResponse":
        task = await self._get_active(task_id)
        updated = await self.repo.patch(
            task,
            data.model_dump(exclude_unset=True),
            nullable_fields=self._NULLABLE_UPDATE_FIELDS,
        )
        return self._to_response(updated)

    async def delete_task(self, task_id: UUID) -> None:
        task = await self._get_active(task_id)
        await self._delete_with_subtasks(task)

    async def _delete_with_subtasks(self, task: Task) -> None:
        """Borra la tarea y, en cascada, sus subtareas vivas.

        El borrado es lógico (`deleted_at`): sin esto, eliminar una tarea
        general dejaba sus subtareas huérfanas pero visibles en la bolsa del
        equipo y en el proyecto, como si nada las hubiera tocado.
        """
        task.soft_delete()
        for child in await self.repo.get_subtasks(task.id):
            await self._delete_with_subtasks(child)

    async def _get_active(self, task_id: UUID) -> Task:
        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise NotFoundError(f"La tarea con el id {task_id} no existe")
        return task

    @staticmethod
    def _to_response(
        task: "Task",
        logged_days: Decimal = Decimal("0"),
        *,
        depends_on_third_party: bool = False,
    ) -> "TaskResponse":
        # `task.assignee` puede no estar cargado (rutas que no hacen el join):
        # leerlo por `__dict__` no dispara lazy-load (rompería en async).
        assignee = task.__dict__.get("assignee")
        assignee_name = (
            f"{assignee.name} {assignee.last_name}".strip()
            if assignee is not None
            else None
        )
        return TaskResponse(
            id=task.id,
            project_id=task.project_id,
            work_item_id=task.work_item_id,
            parent_task_id=task.parent_task_id,
            orden=getattr(task, "orden", 0) or 0,
            represents_work_item=getattr(task, "represents_work_item", False),
            title=task.title,
            description=task.description,
            priority=task.priority,
            assignee_id=task.assignee_id,
            team_id=task.team_id,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status or TaskStatus.PENDIENTE_POR_INICIAR,
            requires_approval=task.requires_approval,
            completed_at=task.completed_at,
            created_at=task.created_at or datetime.now(timezone.utc),
            updated_at=getattr(task, "updated_at", None),
            estimated_days=task.estimated_days,
            logged_days=logged_days,
            assignee_name=assignee_name,
            # Por defecto, por estado. `_rollup_progress` lo recalcula para las
            # tareas que tienen subtareas cargadas en la misma lista.
            progress_pct=compute_task_progress(
                task.status or TaskStatus.PENDIENTE_POR_INICIAR,
                task.requires_approval,
            ),
            depends_on_third_party=depends_on_third_party,
        )


def _dep_response(d: "TaskDependency") -> "TaskDependencyResponse":
    return TaskDependencyResponse(
        id=d.id,
        task_id=d.task_id,
        depends_on_id=d.depends_on_id,
        depends_on_work_item_id=d.depends_on_work_item_id,
    )


class TaskDependencyService:
    """Dependencias finish-to-start de una tarea sobre otra tarea o sobre un
    elemento del árbol (p. ej. una «actividad de terceros»)."""

    def __init__(self, repo: "TaskRepository"):
        self.repo = repo

    async def add_dependency(
        self,
        task_id: UUID,
        depends_on_id: UUID | None = None,
        depends_on_work_item_id: UUID | None = None,
    ) -> "TaskDependencyResponse":
        if (depends_on_id is None) == (depends_on_work_item_id is None):
            raise ValidationError(
                "Indica una tarea O un elemento del que depender, no ambos ni ninguno"
            )

        task = await self.repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        if depends_on_work_item_id is not None:
            return await self._add_work_item_dependency(task, depends_on_work_item_id)

        assert depends_on_id is not None
        return await self._add_task_dependency(task_id, task, depends_on_id)

    async def _add_task_dependency(
        self, task_id: UUID, task: "Task", depends_on_id: UUID
    ) -> "TaskDependencyResponse":
        if rules.is_self_dependency(task_id, depends_on_id):
            raise ConflictError("Una tarea no puede depender de sí misma")

        origen = await self.repo.get_by_id(depends_on_id)
        if not origen or origen.is_deleted:
            raise NotFoundError("La tarea origen no existe")
        if task.project_id != origen.project_id:
            raise ValidationError("Las dependencias deben ser del mismo proyecto")

        # Regla de subtareas: una subtarea es un objetivo específico DENTRO de su
        # tarea padre. Su dependencia FtS solo tiene sentido contra una hermana
        # (mismo `parent_task_id`): no contra el padre, ni contra otra rama, ni
        # contra una tarea suelta. Simétrico: una tarea raíz tampoco puede
        # depender de la subtarea de otra.
        if (
            task.parent_task_id is not None or origen.parent_task_id is not None
        ) and task.parent_task_id != origen.parent_task_id:
            raise ValidationError(
                "Una subtarea solo puede depender de otra subtarea de la misma tarea"
            )

        if await self.repo.dependency_exists(task_id, depends_on_id=depends_on_id):
            raise ConflictError("La dependencia ya existe")

        # Anti-ciclos: solo entre tareas (una arista tarea→elemento no puede
        # cerrar un ciclo con las tarea→tarea).
        edges = [
            (d.task_id, d.depends_on_id)
            for d in await self.repo.get_dependencies_by_project(task.project_id)
            if d.depends_on_id is not None
        ]
        if would_create_cycle(edges, task_id, depends_on_id):
            raise CyclicDependencyError("La dependencia crearía un ciclo")

        dep = await self.repo.add_dependency(
            TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
        )
        return _dep_response(dep)

    async def _add_work_item_dependency(
        self, task: "Task", work_item_id: UUID
    ) -> "TaskDependencyResponse":
        work_item = await self.repo.get_work_item(work_item_id)
        if work_item is None or getattr(work_item, "is_deleted", False):
            raise NotFoundError("El elemento del que depender no existe")
        if work_item.proyecto_id != task.project_id:
            raise ValidationError("Las dependencias deben ser del mismo proyecto")
        if await self.repo.dependency_exists(
            task.id, depends_on_work_item_id=work_item_id
        ):
            raise ConflictError("La dependencia ya existe")

        dep = await self.repo.add_dependency(
            TaskDependency(task_id=task.id, depends_on_work_item_id=work_item_id)
        )
        return _dep_response(dep)

    async def remove_dependency(
        self,
        task_id: UUID,
        depends_on_id: UUID | None = None,
        depends_on_work_item_id: UUID | None = None,
    ) -> None:
        """Quita una dependencia FtS. El id del predecesor puede ser de otra
        tarea o de un elemento; se prueban ambos. 404 si no existía."""
        if depends_on_id is not None:
            deleted = await self.repo.delete_dependency(
                task_id, depends_on_id=depends_on_id
            )
            if not deleted:
                deleted = await self.repo.delete_dependency(
                    task_id, depends_on_work_item_id=depends_on_id
                )
        else:
            deleted = await self.repo.delete_dependency(
                task_id, depends_on_work_item_id=depends_on_work_item_id
            )
        if not deleted:
            raise NotFoundError("La dependencia no existe")

    async def list_dependencies(self, task_id: UUID) -> list["TaskDependencyResponse"]:
        return [_dep_response(d) for d in await self.repo.get_dependencies(task_id)]

    async def list_dependencies_by_project(
        self, project_id: UUID
    ) -> list["TaskDependencyResponse"]:
        return [
            _dep_response(d)
            for d in await self.repo.get_dependencies_by_project(project_id)
        ]


class TaskStatusService:
    """Cambia el estado de una tarea aplicando la regla FtS.

    El "bloqueo por fase anterior" que existía antes desaparece: el orden entre
    fases ahora es una dependencia FtS sobre el WorkItem (motor del slice 2),
    no una regla aparte en tasks.
    """

    def __init__(self, task_repo):
        self.task_repo = task_repo

    async def change_status(
        self, task_id: UUID, data: "UpdateTaskStatusRequest"
    ) -> "TaskResponse":
        task = await self.task_repo.get_by_id(task_id)
        if not task or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        # Regla FtS: mientras la tarea de la que se depende no esté COMPLETADA,
        # esta no puede avanzar de estado. Devolver o cancelar sí se permiten.
        if data.status in rules.FORWARD_STATUSES and data.status != task.status:
            deps = await self.task_repo.get_dependencies(task.id)
            if rules.incomplete_dependency_ids(deps):
                raise ValidationError(
                    "No puedes avanzar: la tarea de la que depende aún no está completada"
                )
            # Compuerta automática de «actividad de terceros»: si esta tarea
            # cuelga (a cualquier profundidad) de una actividad de terceros que
            # aún no fue entregada, no puede avanzar aunque no tenga una
            # dependencia FtS explícita hacia ella.
            if task.work_item_id is not None and hasattr(
                self.task_repo, "has_undelivered_third_party_ancestor"
            ):
                if await self.task_repo.has_undelivered_third_party_ancestor(
                    task.work_item_id
                ):
                    raise ValidationError(
                        "No puedes avanzar: la actividad de terceros de la que "
                        "depende este trabajo aún no fue entregada"
                    )

        patch: dict = {"status": data.status}
        if data.status == TaskStatus.COMPLETADA:
            patch["completed_at"] = datetime.now(timezone.utc)

        updated = await self.task_repo.patch(task, patch)
        assert updated is not None
        return TaskService._to_response(updated)
