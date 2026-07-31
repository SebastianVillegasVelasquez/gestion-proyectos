from datetime import datetime, timezone
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.domain.services import (
    TaskDependencyService,
    TaskService,
    TaskStatusService,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskDependencyResponse,
    TaskResponse,
    TeamTaskItemResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.shared.authz import role_satisfies
from app.shared.base_repository import Repository
from app.shared.events import EventBus
from app.shared.events.events import (
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskSubmitted,
)
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError

# Roles del proyecto que pueden aprobar o devolver una entrega.
_REVIEW_ROLES = {ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR}
# Estado que sólo el revisor puede fijar.
_REVIEW_TARGET_STATUSES = {TaskStatus.COMPLETADA, TaskStatus.DEVUELTA}


async def _get_work_item(repo: WorkTreeRepository, work_item_id: UUID) -> WorkItem:
    item = await repo.get_item(work_item_id)
    if not item or getattr(item, "is_deleted", False):
        raise NotFoundError("El elemento del árbol de trabajo no existe")
    return item


class CreateTaskUseCase:
    def __init__(
        self,
        task_repo: TaskRepository,
        work_tree_repo: WorkTreeRepository,
        user_repo: Repository,
        project_repo: Repository,
        bus: EventBus | None = None,
    ):
        self.task_repo = task_repo
        self.work_tree_repo = work_tree_repo
        self.user_repo = user_repo
        self.project_repo = project_repo
        self.service = TaskService(task_repo)
        self._bus = bus

    async def execute(self, data: CreateTaskRequest) -> TaskResponse:
        # La tarea puede colgar de un elemento existente (se deriva el
        # proyecto de ahí) o crearse suelta apuntando directo al proyecto.
        if data.work_item_id is not None:
            work_item = await _get_work_item(self.work_tree_repo, data.work_item_id)
            if data.project_id is not None and data.project_id != work_item.proyecto_id:
                raise ValidationError(
                    "El elemento indicado no pertenece a ese proyecto"
                )
            data.project_id = work_item.proyecto_id
        else:
            # El validador del schema exige project_id cuando no hay work_item_id.
            assert data.project_id is not None
            project = await self.project_repo.get_by_id(data.project_id)
            if not project or project.is_deleted:
                raise NotFoundError("El proyecto no existe")

        if data.assignee_id:
            user = await self.user_repo.get_by_id(data.assignee_id)
            if not user or user.is_deleted:
                raise NotFoundError("El usuario asignado no existe")

        # Fase 3: si la nueva tarea cuelga de otra (líder repartiendo subtareas
        # de una tarea general del equipo) y no se envía team_id explícito,
        # hereda el del padre. Así aparece en `GET /teams/{id}/tasks` sin pedir
        # al frontend que replique la relación.
        if data.parent_task_id is not None and data.team_id is None:
            parent = await self.task_repo.get_by_id(data.parent_task_id)
            if parent is None or parent.is_deleted:
                raise NotFoundError("La tarea padre no existe")
            data.team_id = parent.team_id

        created = await self.service.add_task(data)
        if data.depends_on_id is not None:
            await TaskDependencyService(self.task_repo).add_dependency(
                created.id, data.depends_on_id
            )

        if self._bus:
            await self._bus.publish(
                TaskCreated(
                    task_id=created.id,
                    work_item_id=data.work_item_id,
                    assigned_id=data.assignee_id,  # type: ignore
                    occurred_at=datetime.now(timezone.utc),
                )
            )

        return created


class GetTasksByProjectUseCase:
    def __init__(self, task_repo: TaskRepository, project_repo: Repository):
        self.project_repo = project_repo
        self.service = TaskService(task_repo)

    async def execute(self, project_id: UUID) -> list[TaskResponse]:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise NotFoundError("El proyecto no existe")
        return await self.service.get_tasks_by_project(project_id)


class GetTasksByTeamUseCase:
    """Tareas delegadas a un equipo (read model del espacio de trabajo).

    Devuelve cada tarea con su módulo, proyecto y responsable ya resueltos, para
    que el workspace las agrupe por módulo ("Módulo 1", …) sin pedir el árbol.
    """

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, team_id: UUID) -> list[TeamTaskItemResponse]:
        rows = await self.task_repo.get_by_team(team_id)
        return [
            TeamTaskItemResponse(
                id=task.id,
                title=task.title,
                status=task.status or TaskStatus.PENDIENTE_POR_INICIAR,
                priority=task.priority,
                work_item_id=task.work_item_id,
                work_item_name=work_item_name,
                project_id=project_id,
                project_name=project_name,
                assignee_id=task.assignee_id,
                assignee_name=assignee_name,
                parent_task_id=task.parent_task_id,
                start_date=task.start_date,
                due_date=task.due_date,
            )
            for task, work_item_name, project_id, project_name, assignee_name in rows
        ]


class GetTasksByWorkItemUseCase:
    def __init__(self, task_repo: TaskRepository, work_tree_repo: WorkTreeRepository):
        self.work_tree_repo = work_tree_repo
        self.service = TaskService(task_repo)

    async def execute(self, work_item_id: UUID) -> list[TaskResponse]:
        await _get_work_item(self.work_tree_repo, work_item_id)
        return await self.service.get_tasks_by_work_item(work_item_id)


class GetTaskByIdUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID) -> TaskResponse:
        return await self.service.get_task_by_id(task_id)


class UpdateTaskUseCase:
    def __init__(self, task_repo: TaskRepository, user_repo: Repository):
        self.user_repo = user_repo
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID, data: UpdateTaskRequest) -> TaskResponse:
        if data.assignee_id:
            user = await self.user_repo.get_by_id(data.assignee_id)
            if not user or user.is_deleted:
                raise NotFoundError("El usuario asignado no existe")
        return await self.service.update_task(task_id, data)


class DeleteTaskUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskService(task_repo)

    async def execute(self, task_id: UUID) -> None:
        await self.service.delete_task(task_id)


async def _get_active_task(task_repo: TaskRepository, task_id: UUID):
    task = await task_repo.get_by_id(task_id)
    if not task or task.is_deleted:
        raise NotFoundError("La tarea no existe")
    return task


class AttachTaskToWorkItemUseCase:
    """Adjunta una tarea suelta (o cambia de elemento) a un WorkItem existente.

    El elemento debe pertenecer al mismo proyecto que la tarea: la estructura
    y las tareas sueltas del proyecto conviven, pero no se cruzan entre
    proyectos.
    """

    def __init__(self, task_repo: TaskRepository, work_tree_repo: WorkTreeRepository):
        self.task_repo = task_repo
        self.work_tree_repo = work_tree_repo

    async def execute(self, task_id: UUID, work_item_id: UUID) -> TaskResponse:
        task = await _get_active_task(self.task_repo, task_id)
        work_item = await _get_work_item(self.work_tree_repo, work_item_id)
        if work_item.proyecto_id != task.project_id:
            raise ValidationError("El elemento pertenece a otro proyecto")

        updated = await self.task_repo.set_work_item(task, work_item_id)
        return TaskService._to_response(updated)


class DetachTaskUseCase:
    """Quita una tarea de la estructura; vuelve a quedar suelta en el proyecto."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, task_id: UUID) -> TaskResponse:
        task = await _get_active_task(self.task_repo, task_id)
        updated = await self.task_repo.set_work_item(task, None)
        return TaskService._to_response(updated)


class AddTaskDependencyUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(
        self, task_id: UUID, depends_on_id: UUID
    ) -> TaskDependencyResponse:
        return await self.service.add_dependency(task_id, depends_on_id)


class GetTaskDependenciesUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(self, task_id: UUID) -> list[TaskDependencyResponse]:
        return await self.service.list_dependencies(task_id)


class ChangeTaskStatusUseCase:
    """Cambia el estado de una tarea con el flujo:

    * El responsable puede mover PENDIENTE → EN_PROGRESO → EN_REVISION (entrega).
    * El líder/supervisor del proyecto puede mover EN_REVISION → COMPLETADA
      (aprobar) o EN_REVISION → DEVUELTA (regresarla para corrección).
    * Cualquier otra combinación queda prohibida — evita que un admin o un
      tercero pise el estado sin ver el avance real.

    Requiere `member_repo` para consultar el rol del usuario en el proyecto.
    """

    def __init__(
        self,
        task_repo: TaskRepository,
        member_repo: ProjectMemberRepository | None = None,
        bus: EventBus | None = None,
    ):
        self.task_repo = task_repo
        self.member_repo = member_repo
        self.service = TaskStatusService(task_repo)
        self._bus = bus

    async def execute(
        self,
        task_id: UUID,
        data: UpdateTaskStatusRequest,
        current_user_id: UUID | None = None,
        current_user_role: str | None = None,
    ) -> TaskResponse:
        task = await self.task_repo.get_by_id(task_id)
        if task is None or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        project_id = task.project_id

        # Autorización: quién puede pedir qué transición.
        if current_user_id is not None:
            await self._authorize(
                current_user_id=current_user_id,
                current_user_role=current_user_role,
                assignee_id=task.assignee_id,
                project_id=project_id,
                new_status=data.status,
            )

        new_status = await self.service.change_status(task_id, data)

        # Los eventos de flujo asumen una tarea con responsable (entrega/aprobación).
        # Con el override de gestión el estado puede cambiar en tareas sin asignar:
        # en ese caso no hay a quién notificar, así que se omite el evento.
        if self._bus and new_status.assignee_id:
            await self._emit_status_event(new_status, data.status, project_id)
        return new_status

    async def _authorize(
        self,
        current_user_id: UUID,
        assignee_id: UUID | None,
        project_id: UUID,
        new_status: TaskStatus,
        current_user_role: str | None = None,
    ) -> None:
        # Override de gestión: admin / super_admin / developer pueden fijar cualquier
        # estado (corrección administrativa). role_satisfies ya trata a developer
        # como tope de la jerarquía.
        if current_user_role is not None and role_satisfies(
            current_user_role, [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
        ):
            return

        # El responsable puede entregar o retomar; nunca autoaprobarse.
        is_assignee = assignee_id is not None and assignee_id == current_user_id
        if new_status not in _REVIEW_TARGET_STATUSES and is_assignee:
            return

        # Sólo el líder/supervisor del proyecto puede aprobar o devolver.
        if self.member_repo is None:
            raise ForbiddenError("No puedes cambiar el estado de esta tarea")
        member = await self.member_repo.get_member_by_project_id_and_user_id(
            project_id=project_id, user_id=current_user_id
        )
        if (
            member is None
            or member.is_deleted
            or member.project_role not in _REVIEW_ROLES
        ):
            raise ForbiddenError(
                "Sólo el responsable puede entregar y sólo el líder/supervisor "
                "puede aprobar o devolver la entrega."
            )

    async def _emit_status_event(
        self,
        task: TaskResponse,
        new_status: TaskStatus,
        project_id: UUID,
    ) -> None:
        assert task.assignee_id is not None
        now = datetime.now(timezone.utc)
        if new_status == TaskStatus.EN_REVISION:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskSubmitted(
                    task_id=task.id,
                    work_item_id=project_id,
                    assigned_id=task.assignee_id,
                    occurred_at=now,
                )
            )
        elif new_status == TaskStatus.COMPLETADA:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskCompleted(
                    task_id=task.id,
                    project_id=project_id,
                    assigned_id=task.assignee_id,
                    occurred_at=now,
                )
            )
        elif new_status == TaskStatus.DEVUELTA:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskReturned(
                    task_id=task.id,
                    project_id=project_id,
                    assigned_id=task.assignee_id,
                    occurred_at=now,
                )
            )
