import datetime
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.domain.services import WorkTreeService
from app.modules.project.structure.presentation.schemas import (
    CloneWorkItemRequest,
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    TipoNodoResponse,
    TrashedItemResponse,
    UpdateTipoNodoRequest,
    UpdateWorkItemRequest,
    WorkItemDependencyResponse,
    WorkItemResponse,
    WorkItemTreeResponse,
)
from app.modules.tasks.application.use_cases import cascade_reschedule_dependents
from app.modules.tasks.domain.audit import TaskAuditor, snapshot
from app.modules.tasks.domain.services import reschedule_task_start
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.shared.base_repository import Repository
from app.shared.events import EventBus
from app.shared.events.events import TaskChainRescheduled, ThirdPartyDeliveryDateSet
from app.shared.exceptions import NotFoundError, ValidationError


async def _ensure_project(project_repo: Repository, proyecto_id: UUID) -> None:
    project = await project_repo.get_by_id(proyecto_id)
    if project is None or getattr(project, "is_deleted", False):
        raise NotFoundError("Proyecto no encontrado")


# ── Tipos de nodo ─────────────────────────────────────────────────────────────
class CreateTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(
        self, proyecto_id: UUID, data: CreateTipoNodoRequest
    ) -> TipoNodoResponse:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.create_tipo(proyecto_id, data)


class UpdateTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, tipo_id: UUID, data: UpdateTipoNodoRequest
    ) -> TipoNodoResponse:
        return await self.service.update_tipo(tipo_id, data)


class DeleteTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, tipo_id: UUID) -> None:
        await self.service.delete_tipo(tipo_id)


class ListTiposNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, proyecto_id: UUID) -> list[TipoNodoResponse]:
        return await self.service.list_tipos(proyecto_id)


# ── Nodos de trabajo ────────────────────────────────────────────────────────────
class CreateWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(
        self, proyecto_id: UUID, data: CreateWorkItemRequest
    ) -> WorkItemResponse:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.create_item(proyecto_id, data)


class UpdateWorkItemUseCase:
    """Edita un elemento del árbol.

    Si el elemento es de un tipo "dependencia de terceros" y este PATCH cambia
    su fecha plan (la de entrega del tercero), publica
    `ThirdPartyDeliveryDateSet`: los responsables de las tareas colgadas de sus
    hijos directos —que estaban a la espera— reciben aviso de que ya pueden
    planificarse. Necesita `task_repo` y `bus` para eso; sin ellos, se comporta
    como antes (solo edita).
    """

    def __init__(
        self,
        repo: WorkTreeRepository,
        task_repo: TaskRepository | None = None,
        bus: EventBus | None = None,
    ):
        self.repo = repo
        self.service = WorkTreeService(repo)
        self.task_repo = task_repo
        self._bus = bus

    async def execute(
        self,
        item_id: UUID,
        data: UpdateWorkItemRequest,
        actor_id: UUID | None = None,
    ) -> WorkItemResponse:
        before = await self.repo.get_item(item_id)
        before_dates = (
            (before.fecha_inicio_plan, before.fecha_fin_plan)
            if before is not None
            else (None, None)
        )
        response = await self.service.update_item(item_id, data)

        if self._bus is not None and self.task_repo is not None:
            await self._maybe_notify_third_party(item_id, data, before_dates, actor_id)
        return response

    async def _maybe_notify_third_party(
        self,
        item_id: UUID,
        data: UpdateWorkItemRequest,
        before_dates: tuple,
        actor_id: UUID | None,
    ) -> None:
        assert self.task_repo is not None and self._bus is not None
        touched = set(data.model_dump(exclude_unset=True))
        if not touched & {"fecha_inicio_plan", "fecha_fin_plan"}:
            return

        item = await self.repo.get_item(item_id)
        if item is None:
            return
        tipo = await self.repo.get_tipo(item.tipo_id)
        if not WorkTreeService._is_third_party(tipo):
            return

        after_dates = (item.fecha_inicio_plan, item.fecha_fin_plan)
        if after_dates == before_dates:
            return

        # Los hijos directos son los que "heredan" la fecha del tercero; sus
        # tareas son las que dependían primero de él.
        all_items = await self.repo.list_items(item.proyecto_id)
        child_ids = {
            i.id for i in all_items if i.parent_id == item_id and not i.is_deleted
        }
        if not child_ids:
            return

        tasks = await self.task_repo.get_all_by_project(item.proyecto_id)
        affected = [
            t
            for t in tasks
            if t.work_item_id in child_ids
            and not t.is_deleted
            and t.assignee_id is not None
        ]
        recipient_ids = tuple(
            {t.assignee_id for t in affected if t.assignee_id is not None}
        )
        if not recipient_ids:
            return

        await self._bus.publish(
            ThirdPartyDeliveryDateSet(
                project_id=item.proyecto_id,
                work_item_id=item.id,
                work_item_nombre=item.nombre,
                delivery_date=item.fecha_fin_plan or item.fecha_inicio_plan,
                recipient_ids=recipient_ids,
                task_ids=tuple(t.id for t in affected),
                actor_id=actor_id,
                occurred_at=datetime.datetime.now(datetime.timezone.utc),
            )
        )


class DeliverThirdPartyActivityUseCase:
    """Marca una «actividad de terceros» como ENTREGADA: el tercero ya nos dio
    los recursos (credenciales, aprobación, respuesta…).

    Efectos:
      * Fija su fecha real de fin → abre la compuerta: el trabajo que colgaba
        de ella (elementos y tareas, a cualquier profundidad) ya puede avanzar.
      * Cascada de fechas: las tareas que dependían FtS de esta actividad
        arrancan en la fecha de entrega (conservando su duración) y se avisa a
        sus responsables.
    """

    def __init__(
        self,
        repo: WorkTreeRepository,
        task_repo: TaskRepository,
        bus: EventBus | None = None,
    ):
        self.repo = repo
        self.service = WorkTreeService(repo)
        self.task_repo = task_repo
        self._bus = bus

    async def execute(
        self,
        item_id: UUID,
        delivered_on: datetime.date | None = None,
        actor_id: UUID | None = None,
        delivered: bool = True,
    ) -> WorkItemResponse:
        item = await self.repo.get_item(item_id)
        if item is None or item.is_deleted:
            raise NotFoundError("Nodo de trabajo no encontrado")
        tipo = await self.repo.get_tipo(item.tipo_id)
        if not WorkTreeService._is_third_party(tipo):
            raise ValidationError(
                "Solo una «actividad de terceros» se marca como entregada"
            )

        # Reabrir la compuerta: el tercero aún no entregó (o fue un error). Se
        # limpian las fechas reales; los hijos vuelven a posicionarse sobre la
        # fecha PLAN al re-derivarse y su subárbol queda gateado otra vez.
        if not delivered:
            item.fecha_fin_real = None
            item.fecha_inicio_real = None
            await self.repo.save_item(item)
            return await self.service.get_item(item_id)

        fecha = delivered_on or datetime.date.today()
        item.fecha_fin_real = fecha
        # La fecha de entrega es también el INICIO real: es cuando el trabajo
        # que colgaba del tercero puede empezar. (Se re-fija en cada entrega
        # para que corregir la fecha corrija ambas.)
        item.fecha_inicio_real = fecha
        await self.repo.save_item(item)

        await self._cascade_to_dependent_tasks(item, fecha, actor_id)
        return await self.service.get_item(item_id)

    async def _cascade_to_dependent_tasks(
        self, item, fecha: datetime.date, actor_id: UUID | None
    ) -> None:
        dependents = await self.task_repo.get_dependents_of_work_item(item.id)
        changed: list[Task] = []
        seen: set[UUID] = set()
        for dep in dependents:
            if dep.status in (TaskStatus.COMPLETADA, TaskStatus.CANCELADA):
                continue
            before = snapshot(dep)
            if reschedule_task_start(dep, fecha, recompute_due_from_estimate=True):
                await self.task_repo.save(dep)
                await TaskAuditor(self.task_repo, actor_id).diff(before, dep)
                changed.append(dep)
                seen.add(dep.id)
                # En cadena: las tareas que dependen de ESTA tarea (no del
                # tercero) arrancan tras su nuevo fin y recalculan el suyo.
                if dep.due_date is not None:
                    await cascade_reschedule_dependents(
                        self.task_repo,
                        self._bus,
                        source_id=dep.id,
                        source_title=dep.title,
                        project_id=item.proyecto_id,
                        anchor=dep.due_date,
                        actor_id=actor_id,
                        _seen=seen,
                    )

        if changed and self._bus is not None:
            recipients = tuple(
                {d.assignee_id for d in changed if d.assignee_id is not None}
            )
            await self._bus.publish(
                TaskChainRescheduled(
                    project_id=item.proyecto_id,
                    trigger_kind="third_party",
                    trigger_name=item.nombre,
                    new_start=fecha,
                    task_ids=tuple(d.id for d in changed),
                    recipient_ids=recipients,
                    actor_id=actor_id,
                    occurred_at=datetime.datetime.now(datetime.timezone.utc),
                )
            )


class DeleteWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> None:
        await self.service.delete_item(item_id)


class ListTrashUseCase:
    """Papelera del proyecto: lo borrado que todavía se puede recuperar."""

    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, proyecto_id: UUID) -> list[TrashedItemResponse]:
        return await self.service.list_trash(proyecto_id)


class RestoreWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> WorkItemResponse:
        return await self.service.restore_item(item_id)


class MoveWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, item_id: UUID, new_parent_id: UUID | None, orden: int | None
    ) -> WorkItemResponse:
        return await self.service.move_item(item_id, new_parent_id, orden)


class ShiftWorkItemSubtreeUseCase:
    """Desplaza en el tiempo un subárbol y, opcionalmente, sus tareas.

    El dominio (`WorkTreeService`) mueve las fechas de la estructura; aquí se
    orquesta además el desplazamiento de las tareas colgadas del subárbol, que
    cruzan el límite del módulo de tareas.
    """

    def __init__(self, repo: WorkTreeRepository, task_repo: TaskRepository):
        self.service = WorkTreeService(repo)
        self.task_repo = task_repo

    async def execute(
        self, item_id: UUID, offset_days: int, shift_tasks: bool
    ) -> WorkItemResponse:
        response, descendant_ids = await self.service.shift_subtree(
            item_id, offset_days
        )
        if shift_tasks and offset_days != 0:
            await self._shift_tasks(
                project_id=response.proyecto_id,
                work_item_ids=set(descendant_ids),
                offset_days=offset_days,
            )
        return response

    async def _shift_tasks(
        self, *, project_id: UUID, work_item_ids: set[UUID], offset_days: int
    ) -> None:
        offset = datetime.timedelta(days=offset_days)
        tasks = await self.task_repo.get_all_by_project(project_id)
        for task in tasks:
            if task.work_item_id not in work_item_ids:
                continue
            if task.start_date is not None:
                task.start_date = task.start_date + offset
            if task.due_date is not None:
                task.due_date = task.due_date + offset
            await self.task_repo.save(task)


class GetWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> WorkItemResponse:
        return await self.service.get_item(item_id)


class GetWorkTreeUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(self, proyecto_id: UUID) -> list[WorkItemTreeResponse]:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.get_tree(proyecto_id)


class CloneWorkItemUseCase:
    """Duplica un subárbol (una o varias veces) y, opcionalmente, sus tareas.

    La estructura la clona el dominio (`WorkTreeService`); aquí, en la capa de
    aplicación, se orquesta además la copia profunda de las tareas colgadas del
    subárbol, porque cruzan el límite del módulo de tareas.
    """

    def __init__(self, repo: WorkTreeRepository, task_repo: TaskRepository):
        self.service = WorkTreeService(repo)
        self.task_repo = task_repo

    async def execute(
        self, source_id: UUID, data: CloneWorkItemRequest
    ) -> WorkItemResponse:
        response, id_maps = await self.service.clone_subtree_with_maps(source_id, data)
        if data.include_tasks:
            await self._copy_tasks(
                project_id=response.proyecto_id,
                id_maps=id_maps,
                offset_days=data.offset_days,
            )
        return response

    async def _copy_tasks(
        self,
        *,
        project_id: UUID,
        id_maps: list[dict[UUID, UUID]],
        offset_days: int,
    ) -> None:
        """Replica, por cada pegada, las tareas colgadas del subárbol origen.

        Copia PROFUNDA: se replican las tareas adjuntas a los elementos copiados
        y TODAS sus subtareas —a cualquier profundidad, aunque cuelguen solo por
        `parent_task_id` sin elemento propio— conservando responsable/equipo,
        prioridad, estimación de esfuerzo en días, orden entre hermanas, si
        requieren aprobación y si la tarea ES su elemento (`represents_work_item`).
        Se RESETEA el estado y las fechas reales; las fechas plan se desplazan
        igual que la estructura. Las dependencias FtS se recrean cuando ambos
        extremos caen dentro del subárbol copiado (tarea→tarea) o el predecesor
        es uno de los elementos clonados (tarea→elemento); las que apuntan fuera
        se descartan.

        Nada de esto emite notificaciones: clonar decenas de cursos con sus
        tareas dispararía un aluvión de avisos de asignación sin valor. El clon
        llega "en frío" y el responsable lo ve al abrir el proyecto.
        """
        source_work_item_ids = {old for m in id_maps for old in m}
        if not source_work_item_ids:
            return

        all_tasks = await self.task_repo.get_all_by_project(project_id)
        scoped = self._tasks_in_scope(all_tasks, source_work_item_ids)
        if not scoped:
            return

        scoped_ids = {t.id for t in scoped}
        all_deps = await self.task_repo.get_dependencies_by_project(project_id)
        scoped_deps = [d for d in all_deps if d.task_id in scoped_ids]

        offset = datetime.timedelta(days=offset_days)
        for id_map in id_maps:
            await self._paste_tasks(scoped, scoped_deps, id_map, offset)

    @staticmethod
    def _tasks_in_scope(
        all_tasks: list[Task], source_work_item_ids: set[UUID]
    ) -> list[Task]:
        """Tareas adjuntas al subárbol más sus subtareas (por `parent_task_id`)."""
        children_by_parent: dict[UUID, list[Task]] = {}
        for task in all_tasks:
            if task.parent_task_id is not None:
                children_by_parent.setdefault(task.parent_task_id, []).append(task)

        roots = [t for t in all_tasks if t.work_item_id in source_work_item_ids]
        scoped: dict[UUID, Task] = {}
        stack = list(roots)
        while stack:
            task = stack.pop()
            if task.id in scoped:
                continue
            scoped[task.id] = task
            stack.extend(children_by_parent.get(task.id, []))
        return list(scoped.values())

    async def _paste_tasks(
        self,
        scoped: list[Task],
        scoped_deps: list[TaskDependency],
        id_map: dict[UUID, UUID],
        offset: datetime.timedelta,
    ) -> None:
        scoped_ids = {t.id for t in scoped}
        new_task_id_by_old: dict[UUID, UUID] = {}

        # Pasada 1: crear cada clon sin padre (el padre puede no existir aún).
        clones_by_old: dict[UUID, Task] = {}
        for task in scoped:
            clone = Task(
                title=task.title,
                description=task.description,
                priority=task.priority,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                project_id=task.project_id,
                work_item_id=id_map.get(task.work_item_id, task.work_item_id)
                if task.work_item_id is not None
                else None,
                assignee_id=task.assignee_id,
                team_id=task.team_id,
                parent_task_id=None,
                # Esfuerzo ESTIMADO en días: es plan, se conserva. El tiempo
                # realmente dedicado (`time_entries`) NO se copia: el clon
                # arranca sin horas registradas.
                estimated_days=task.estimated_days,
                orden=task.orden,
                requires_approval=task.requires_approval,
                represents_work_item=task.represents_work_item,
                # Las fechas son opcionales: si la tarea original no tiene, el
                # clon tampoco; solo desplazamos las que existen.
                start_date=task.start_date + offset if task.start_date else None,
                due_date=task.due_date + offset if task.due_date else None,
                completed_at=None,
            )
            saved = await self.task_repo.add(clone)
            new_task_id_by_old[task.id] = saved.id
            clones_by_old[task.id] = saved

        # Pasada 2: reconectar subtareas cuyo padre también se copió.
        for old_id, clone in clones_by_old.items():
            parent_old = next(t.parent_task_id for t in scoped if t.id == old_id)
            if parent_old is not None and parent_old in scoped_ids:
                clone.parent_task_id = new_task_id_by_old[parent_old]
                await self.task_repo.add(clone)

        # Pasada 3: recrear las dependencias FtS internas al subárbol.
        # tarea→tarea si ambos extremos se copiaron; tarea→elemento si el
        # predecesor es uno de los elementos clonados. Las externas se descartan.
        for dep in scoped_deps:
            new_task_id = new_task_id_by_old.get(dep.task_id)
            if new_task_id is None:
                continue
            if dep.depends_on_id is not None:
                new_pred = new_task_id_by_old.get(dep.depends_on_id)
                if new_pred is None:
                    continue
                await self.task_repo.add_dependency(
                    TaskDependency(task_id=new_task_id, depends_on_id=new_pred)
                )
            elif dep.depends_on_work_item_id is not None:
                new_wi = id_map.get(dep.depends_on_work_item_id)
                if new_wi is None:
                    continue
                await self.task_repo.add_dependency(
                    TaskDependency(task_id=new_task_id, depends_on_work_item_id=new_wi)
                )


# ── Dependencias Finish-to-Start ────────────────────────────────────────────────
class AddWorkItemDependencyUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, work_item_id: UUID, depends_on_id: UUID
    ) -> WorkItemDependencyResponse:
        return await self.service.add_dependency(work_item_id, depends_on_id)


class RemoveWorkItemDependencyUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, work_item_id: UUID, depends_on_id: UUID) -> None:
        await self.service.remove_dependency(work_item_id, depends_on_id)


class ListWorkItemDependenciesUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, work_item_id: UUID) -> list[WorkItemDependencyResponse]:
        return await self.service.list_dependencies(work_item_id)
