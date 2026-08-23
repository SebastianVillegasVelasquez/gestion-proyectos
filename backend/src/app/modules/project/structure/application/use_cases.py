import datetime
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.domain.services import WorkTreeService
from app.modules.project.structure.presentation.schemas import (
    CloneWorkItemRequest,
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    TipoNodoResponse,
    UpdateTipoNodoRequest,
    UpdateWorkItemRequest,
    WorkItemDependencyResponse,
    WorkItemResponse,
    WorkItemTreeResponse,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.shared.base_repository import Repository
from app.shared.exceptions import NotFoundError


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
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, item_id: UUID, data: UpdateWorkItemRequest
    ) -> WorkItemResponse:
        return await self.service.update_item(item_id, data)


class DeleteWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> None:
        await self.service.delete_item(item_id)


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

        Se copian las tareas adjuntas a los elementos copiados y sus subtareas
        (aunque cuelguen por `parent_task_id` sin elemento propio). Se conserva
        responsable/equipo, prioridad y duración; se RESETEA el estado y las
        fechas reales, y se desplazan `start_date`/`due_date` igual que la
        estructura. Las dependencias FtS entre tareas no se copian.
        """
        source_work_item_ids = {old for m in id_maps for old in m}
        if not source_work_item_ids:
            return

        all_tasks = await self.task_repo.get_all_by_project(project_id)
        scoped = self._tasks_in_scope(all_tasks, source_work_item_ids)
        if not scoped:
            return

        offset = datetime.timedelta(days=offset_days)
        for id_map in id_maps:
            await self._paste_tasks(scoped, id_map, offset)

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
