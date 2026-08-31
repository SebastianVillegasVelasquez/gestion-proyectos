from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.domain.audit import TaskAuditor, snapshot
from app.modules.tasks.domain.services import (
    TaskDependencyService,
    TaskService,
    TaskStatusService,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import (
    TaskComment,
    TaskCommentMention,
    TaskTimeEntry,
)
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.project.structure.domain.services import WorkTreeService
from app.modules.tasks.presentation.schemas import (
    BlockingTaskResponse,
    BulkTasksFromBranchRequest,
    BulkTasksResultResponse,
    CommentResponse,
    CreateCommentRequest,
    CreateTaskRequest,
    CreateTeamTaskRequest,
    CreateTimeEntryRequest,
    SkippedElementResponse,
    TaskEffortResponse,
    TimeEntryResponse,
    TaskDependencyResponse,
    TaskResponse,
    TeamTaskItemResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.repository import ProjectMemberRepository
from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.enums import TeamRole
from app.shared.authz import role_satisfies
from app.shared.base_repository import Repository
from app.shared.events import EventBus
from app.shared.events.events import (
    TaskAssigned,
    TaskCommented,
    TaskCompleted,
    TaskCreated,
    TaskReturned,
    TaskStarted,
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

    async def execute(
        self, data: CreateTaskRequest, actor_id: UUID | None = None
    ) -> TaskResponse:
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
        # de una tarea general del equipo), hereda lo que no se envíe explícito:
        #   - `team_id`  → aparece en `GET /teams/{id}/tasks`.
        #   - `work_item_id` → la subtarea cuelga del MISMO elemento del padre,
        #     así modifica la estructura y el cronograma principales (no queda
        #     invisible fuera del árbol).
        if data.parent_task_id is not None:
            parent = await self.task_repo.get_by_id(data.parent_task_id)
            if parent is None or parent.is_deleted:
                raise NotFoundError("La tarea padre no existe")
            if data.team_id is None:
                data.team_id = parent.team_id
            if data.work_item_id is None and parent.work_item_id is not None:
                data.work_item_id = parent.work_item_id

        created = await self.service.add_task(data)
        if data.depends_on_id is not None:
            await TaskDependencyService(self.task_repo).add_dependency(
                created.id, data.depends_on_id
            )

        # El historial se escribe aquí y no en un manejador del bus: el actor
        # es quien ejecuta la petición, un dato que el evento de notificación
        # no lleva (lleva el asignado, que es otra persona).
        await TaskAuditor(self.task_repo, actor_id).created(
            created.id, created.title, created.status
        )

        if self._bus:
            await self._bus.publish(
                TaskCreated(
                    task_id=created.id,
                    work_item_id=data.work_item_id,
                    assigned_id=data.assignee_id,  # type: ignore
                    project_id=created.project_id,
                    team_id=data.team_id,
                    occurred_at=datetime.now(timezone.utc),
                )
            )

        return created


class CreateTeamTaskUseCase:
    """Alta de una tarea desde el espacio de un equipo, hecha por su líder o
    supervisor (rol de EQUIPO, no de sistema): el flujo administrativo de
    `POST /tasks` sigue siendo solo-admin.

    El equipo y el proyecto salen del contexto, no del cuerpo. Se valida que:
      - el actor lidera o supervisa el equipo;
      - el elemento (si viene) es del proyecto del equipo;
      - el responsable (si viene) es integrante del equipo;
      - la tarea padre (si viene) es de este mismo equipo.

    La tarea nace como "tarea del equipo" (con `team_id`, sin responsable) y, si
    llega `assignee_id`, se asigna acto seguido por el MISMO camino que usa el
    líder para reasignar (`UpdateTaskUseCase`), que deja `team_id` intacto. Así
    el XOR persona/equipo de la creación se respeta y el estado final
    «tarea del equipo con responsable» se alcanza por la vía sancionada.
    """

    def __init__(
        self,
        task_repo: TaskRepository,
        work_tree_repo: WorkTreeRepository,
        user_repo: Repository,
        project_repo: Repository,
        team_repo: TeamRepository,
        bus: EventBus | None = None,
    ):
        self.task_repo = task_repo
        self.work_tree_repo = work_tree_repo
        self.user_repo = user_repo
        self.project_repo = project_repo
        self.team_repo = team_repo
        self._bus = bus

    async def execute(
        self, team_id: UUID, data: CreateTeamTaskRequest, actor_id: UUID
    ) -> TaskResponse:
        actor = await self.team_repo.get_member(team_id, actor_id)
        if actor is None or actor.team_role not in (
            TeamRole.LIDER,
            TeamRole.SUPERVISOR,
        ):
            raise ForbiddenError(
                "Solo el líder o el supervisor del equipo crean tareas"
            )

        team = await self.team_repo.get_team_by_id(team_id)
        if team is None:
            raise NotFoundError("El equipo no existe")

        if data.work_item_id is not None:
            work_item = await _get_work_item(self.work_tree_repo, data.work_item_id)
            if work_item.proyecto_id != team.project_id:
                raise ValidationError("El elemento pertenece a otro proyecto")

        if data.assignee_id is not None:
            member = await self.team_repo.get_member(team_id, data.assignee_id)
            if member is None:
                raise ValidationError("El responsable no es integrante del equipo")

        if data.parent_task_id is not None:
            parent = await self.task_repo.get_by_id(data.parent_task_id)
            if parent is None or parent.is_deleted:
                raise NotFoundError("La tarea padre no existe")
            if parent.team_id != team_id:
                raise ValidationError("La tarea padre no es de este equipo")

        created = await CreateTaskUseCase(
            self.task_repo,
            self.work_tree_repo,
            self.user_repo,
            self.project_repo,
            self._bus,
        ).execute(
            CreateTaskRequest(
                title=data.title,
                priority=data.priority,
                description=data.description,
                project_id=team.project_id,
                team_id=team_id,
                work_item_id=data.work_item_id,
                parent_task_id=data.parent_task_id,
                depends_on_id=data.depends_on_id,
                start_date=data.start_date,
                due_date=data.due_date,
                requires_approval=data.requires_approval,
            ),
            actor_id=actor_id,
        )

        if data.assignee_id is None:
            return created

        # Ya autorizamos al actor como líder/supervisor: la asignación es un
        # paso interno de confianza (actor_role=None), no una reasignación
        # sujeta a nueva comprobación.
        return await UpdateTaskUseCase(
            self.task_repo, self.user_repo, self.team_repo, self._bus
        ).execute(created.id, UpdateTaskRequest(assignee_id=data.assignee_id), actor_id)


class CreateTasksFromBranchUseCase:
    """Da de alta una tarea por cada elemento de una rama de la estructura.

    Montar un proyecto significa convertir decenas de piezas del árbol en
    trabajo asignado; hacerlo de una en una es el cuello de botella. Reutiliza
    `CreateTaskUseCase` para cada elemento en vez de escribir en la tabla por su
    cuenta: así las validaciones, las dependencias y los eventos (y por tanto
    las notificaciones) son exactamente los mismos que al crear una tarea suelta.

    Es idempotente en la práctica: por defecto salta los elementos que ya
    tienen tarea, así que relanzarlo sobre la misma rama solo crea lo que falta.
    """

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
        self.create_task = CreateTaskUseCase(
            task_repo, work_tree_repo, user_repo, project_repo, bus
        )

    async def execute(
        self, root_item_id: UUID, data: BulkTasksFromBranchRequest
    ) -> BulkTasksResultResponse:
        root = await _get_work_item(self.work_tree_repo, root_item_id)
        # Tomamos la rama del ÁRBOL (no de la tabla) para heredar las fechas
        # efectivas, que es lo que se ve en el cronograma: un elemento puede no
        # tener fechas propias y recibirlas de su duración o de su contenedor.
        tree = await WorkTreeService(self.work_tree_repo).get_tree(root.proyecto_id)
        branch = _find_branch(tree, root_item_id)
        if branch is None:
            raise NotFoundError("El elemento del árbol de trabajo no existe")

        candidates = _flatten_branch(branch, only_leaves=data.only_leaves)

        # Qué elementos de la rama ya tienen tarea, en UNA consulta. Preguntarlo
        # elemento a elemento era una consulta por pieza: sobre una unidad con
        # cientos de piezas, cientos de idas y vueltas antes de crear nada.
        already_with_tasks: set[UUID] = set()
        if data.skip_with_tasks:
            already_with_tasks = await self.task_repo.work_items_with_tasks(
                [element.id for element in candidates]
            )

        created: list[TaskResponse] = []
        skipped: list[SkippedElementResponse] = []
        for element in candidates:
            if element.id in already_with_tasks:
                skipped.append(
                    SkippedElementResponse(
                        work_item_id=element.id,
                        nombre=element.nombre,
                        motivo="Ya tiene una tarea",
                    )
                )
                continue
            try:
                task = await self.create_task.execute(
                    CreateTaskRequest(
                        title=element.nombre,
                        work_item_id=element.id,
                        priority=data.priority,
                        assignee_id=data.assignee_id,
                        team_id=data.team_id,
                        start_date=(
                            element.fecha_inicio_plan if data.inherit_dates else None
                        ),
                        due_date=element.fecha_fin_plan if data.inherit_dates else None,
                    )
                )
                created.append(task)
            except (ValidationError, NotFoundError) as exc:
                # Una pieza problemática (un nombre de una letra, fechas
                # imposibles) no puede tumbar la carga entera: se reporta y se
                # sigue, igual que en la carga masiva de usuarios por CSV.
                skipped.append(
                    SkippedElementResponse(
                        work_item_id=element.id,
                        nombre=element.nombre,
                        motivo=str(exc),
                    )
                )

        return BulkTasksResultResponse(
            created=created, skipped=skipped, total_elementos=len(candidates)
        )


def _find_branch(nodes, item_id: UUID):
    for node in nodes:
        if node.id == item_id:
            return node
        found = _find_branch(node.children, item_id)
        if found is not None:
            return found
    return None


def _flatten_branch(branch, only_leaves: bool) -> list:
    """Elementos candidatos de la rama, incluida su raíz cuando corresponde.

    Con `only_leaves` nos quedamos con lo que no contiene nada más: los
    elementos con contenido suelen ser agrupadores ("Unidad 3"), y lo que
    alguien produce de verdad son sus piezas.
    """
    out: list = []

    def walk(node) -> None:
        # Recorrido en profundidad respetando `orden` DENTRO de cada nivel: así
        # las tareas se crean en el mismo orden en que se lee el árbol. Ordenar
        # la lista plana por `orden` mezclaría niveles (el 0 de una unidad con
        # el 0 de sus piezas) y daría una secuencia arbitraria.
        if not only_leaves or not node.children:
            out.append(node)
        for child in sorted(node.children, key=lambda c: (c.orden, c.nombre)):
            walk(child)

    walk(branch)
    return out


class AddCommentUseCase:
    """Publica un comentario en una tarea y avisa a quien corresponda.

    Cualquiera con acceso puede comentar: la conversación es el mecanismo por
    el que se pide una corrección o se explica una decisión, y limitarla a
    administración la mandaría de vuelta a WhatsApp.
    """

    def __init__(self, task_repo: TaskRepository, bus: EventBus | None = None):
        self.task_repo = task_repo
        self._bus = bus

    async def execute(
        self, task_id: UUID, author_id: UUID, data: CreateCommentRequest
    ) -> CommentResponse:
        task = await self.task_repo.get_by_id(task_id)
        if task is None or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        # Sin duplicados y sin autopmenciones: mencionarte a ti mismo no es una
        # petición a nadie.
        mentioned = [uid for uid in dict.fromkeys(data.mentioned_user_ids)]
        comment = await self.task_repo.add_comment(
            TaskComment(
                task_id=task_id,
                author_id=author_id,
                body=data.body,
                mentions=[TaskCommentMention(user_id=uid) for uid in mentioned],
            )
        )

        if self._bus:
            await self._bus.publish(
                TaskCommented(
                    task_id=task_id,
                    comment_id=comment.id,
                    author_id=author_id,
                    assignee_id=task.assignee_id,
                    mentioned_user_ids=tuple(mentioned),
                    project_id=getattr(task, "project_id", None),
                    team_id=getattr(task, "team_id", None),
                    occurred_at=datetime.now(timezone.utc),
                )
            )

        return CommentResponse(
            id=comment.id,
            task_id=comment.task_id,
            author_id=comment.author_id,
            body=comment.body,
            mentioned_user_ids=mentioned,
            created_at=comment.created_at,
        )


class ListCommentsUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, task_id: UUID) -> list[CommentResponse]:
        rows = await self.task_repo.get_comments(task_id)
        return [
            CommentResponse(
                id=comment.id,
                task_id=comment.task_id,
                author_id=comment.author_id,
                author_name=f"{name} {last_name}".strip(),
                body=comment.body,
                mentioned_user_ids=[m.user_id for m in comment.mentions],
                created_at=comment.created_at,
            )
            for comment, name, last_name in rows
        ]


class DeleteCommentUseCase:
    """Borra un comentario. Solo su autor o administración: lo que otro dijo no
    se borra por la espalda."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, comment_id: UUID, actor_id: UUID, actor_role: str) -> None:
        comment = await self.task_repo.get_comment(comment_id)
        if comment is None or comment.is_deleted:
            raise NotFoundError("El comentario no existe")
        is_admin = role_satisfies(actor_role, ("admin", "super_admin", "developer"))
        if comment.author_id != actor_id and not is_admin:
            raise ForbiddenError("Solo puedes borrar tus propios comentarios")
        # Borrado lógico: la conversación es la memoria de por qué se hizo algo.
        comment.soft_delete()


class LogTimeUseCase:
    """Apunta horas dedicadas a una tarea.

    Cualquiera que trabaje en la tarea puede apuntar SUS horas: el apunte
    queda a nombre de quien lo hace (no se puede registrar tiempo por otro),
    que es lo que hace fiable el dato para pagar o para estimar mejor.
    """

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(
        self, task_id: UUID, user_id: UUID, data: CreateTimeEntryRequest
    ) -> TimeEntryResponse:
        task = await self.task_repo.get_by_id(task_id)
        if task is None or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        entry = await self.task_repo.add_time_entry(
            TaskTimeEntry(
                task_id=task_id,
                user_id=user_id,
                hours=data.hours,
                work_date=data.work_date,
                notes=data.notes,
            )
        )
        return TimeEntryResponse(
            id=entry.id,
            task_id=entry.task_id,
            user_id=entry.user_id,
            hours=entry.hours,
            work_date=entry.work_date,
            notes=entry.notes,
            created_at=entry.created_at,
        )


class GetTaskEffortUseCase:
    """Estimado vs. dedicado de una tarea, con el detalle de los apuntes."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, task_id: UUID) -> TaskEffortResponse:
        task = await self.task_repo.get_by_id(task_id)
        if task is None or task.is_deleted:
            raise NotFoundError("La tarea no existe")

        rows = await self.task_repo.get_time_entries(task_id)
        entries = [
            TimeEntryResponse(
                id=entry.id,
                task_id=entry.task_id,
                user_id=entry.user_id,
                user_name=f"{name} {last_name}".strip(),
                hours=entry.hours,
                work_date=entry.work_date,
                notes=entry.notes,
                created_at=entry.created_at,
            )
            for entry, name, last_name in rows
        ]
        return TaskEffortResponse(
            task_id=task_id,
            estimated_hours=task.estimated_hours,
            logged_hours=sum((e.hours for e in entries), Decimal("0")),
            entries=entries,
        )


class DeleteTimeEntryUseCase:
    """Borra un apunte de horas.

    Solo su autor o alguien de administración: un apunte ajeno equivocado se
    corrige hablando, no borrándolo por la espalda.
    """

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, entry_id: UUID, actor_id: UUID, actor_role: str) -> None:
        entry = await self.task_repo.get_time_entry(entry_id)
        if entry is None:
            raise NotFoundError("El registro de horas no existe")
        is_admin = role_satisfies(actor_role, ("admin", "super_admin", "developer"))
        if entry.user_id != actor_id and not is_admin:
            raise ForbiddenError("Solo puedes borrar tus propios registros de horas")
        await self.task_repo.delete_time_entry(entry)


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

        # Dos consultas en total (tareas + dependencias), no una por tarea:
        # agrupamos las bloqueantes por task_id antes de armar la respuesta.
        blocking: dict[UUID, list[BlockingTaskResponse]] = {}
        for dep in await self.task_repo.get_dependencies_by_team(team_id):
            blocking.setdefault(dep.task_id, []).append(
                BlockingTaskResponse(
                    id=dep.depends_on.id,
                    title=dep.depends_on.title,
                    status=dep.depends_on.status or TaskStatus.PENDIENTE_POR_INICIAR,
                )
            )

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
                requires_approval=task.requires_approval,
                blocked_by=blocking.get(task.id, []),
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
    def __init__(
        self,
        task_repo: TaskRepository,
        user_repo: Repository,
        team_repo: TeamRepository | None = None,
        bus: EventBus | None = None,
    ):
        self.task_repo = task_repo
        self.user_repo = user_repo
        # Solo se necesita para autorizar la reasignación de un líder de equipo;
        # los llamadores administrativos pueden omitirlo.
        self.team_repo = team_repo
        # Opcional: al reasignar (cambia el responsable) publica `TaskAssigned`
        # para que se avise a la persona. Los llamadores que no lo pasen no
        # notifican, como hasta ahora.
        self._bus = bus
        self.service = TaskService(task_repo)

    async def execute(
        self,
        task_id: UUID,
        data: UpdateTaskRequest,
        actor_id: UUID | None = None,
        actor_role: str | None = None,
    ) -> TaskResponse:
        # Foto de los campos auditables ANTES de mutar: un PATCH puede tocar
        # varios a la vez y cada uno se registra como un hecho aparte.
        task = await _get_active_task(self.task_repo, task_id)

        # Sin rol (llamador interno/administrativo) se mantiene el permiso amplio
        # de siempre. Con rol no-admin, el único cambio permitido es que el
        # líder/supervisor del equipo reasigne la tarea entre los suyos.
        is_admin = actor_role is None or role_satisfies(
            actor_role, ("admin", "super_admin", "developer")
        )
        if not is_admin:
            await self._authorize_team_lead_edit(task, data, actor_id)

        if data.assignee_id:
            user = await self.user_repo.get_by_id(data.assignee_id)
            if not user or user.is_deleted:
                raise NotFoundError("El usuario asignado no existe")

        previous_assignee_id = task.assignee_id
        team_id = task.team_id
        project_id = getattr(task, "project_id", None)
        work_item_id = getattr(task, "work_item_id", None)

        before = snapshot(task)
        updated = await self.service.update_task(task_id, data)
        await TaskAuditor(self.task_repo, actor_id).diff(before, task)

        # Reasignación efectiva → avisar a la persona (salvo que se asigne a sí
        # misma). Cubre el hueco de `TaskCreated`, que solo dispara al crear.
        if (
            self._bus is not None
            and updated.assignee_id is not None
            and updated.assignee_id != previous_assignee_id
        ):
            await self._bus.publish(
                TaskAssigned(
                    task_id=updated.id,
                    assignee_id=updated.assignee_id,
                    assigned_by=actor_id,
                    project_id=project_id,
                    team_id=team_id,
                    work_item_id=work_item_id,
                    occurred_at=datetime.now(timezone.utc),
                )
            )

        return updated

    async def _authorize_team_lead_edit(
        self, task, data: UpdateTaskRequest, actor_id: UUID | None
    ) -> None:
        """El líder/supervisor de un equipo edita las tareas DE SU EQUIPO —
        título, prioridad, fechas, responsable, aprobación, etc. — pero no
        puede sacarlas del equipo (`team_id`) ni tocar campos de estructura
        (`work_item_id` va por adjuntar/quitar, no por aquí). Cualquier tarea
        fuera de su equipo sigue siendo de administración exclusivamente."""
        if self.team_repo is None or actor_id is None:
            raise ForbiddenError("No tienes permiso para editar esta tarea")

        touched = set(data.model_dump(exclude_unset=True))
        if not touched:
            return
        if not touched <= _TEAM_LEAD_EDITABLE_FIELDS:
            raise ForbiddenError("No puedes editar esos campos de la tarea")

        if task.team_id is None:
            raise ForbiddenError("Esta tarea no está delegada a un equipo")

        actor = await self.team_repo.get_member(task.team_id, actor_id)
        if actor is None or actor.team_role not in (
            TeamRole.LIDER,
            TeamRole.SUPERVISOR,
        ):
            raise ForbiddenError("No lideras el equipo de esta tarea")

        if data.assignee_id is not None:
            new_owner = await self.team_repo.get_member(task.team_id, data.assignee_id)
            if new_owner is None:
                raise ForbiddenError("Solo puedes asignar a integrantes de tu equipo")


# Campos que un líder/supervisor de equipo (rol de EQUIPO, no de sistema)
# puede tocar en una tarea de SU equipo vía PATCH /tasks/{id}. `team_id` queda
# fuera a propósito: mover la tarea a otro equipo sigue siendo de administración.
_TEAM_LEAD_EDITABLE_FIELDS = {
    "assignee_id",
    "title",
    "description",
    "priority",
    "start_date",
    "due_date",
    "estimated_hours",
    "requires_approval",
}


class DeleteTaskUseCase:
    """Borra una tarea (y en cascada sus subtareas). De administración, salvo
    que el líder/supervisor de SU equipo borre una tarea delegada a él."""

    def __init__(
        self, task_repo: TaskRepository, team_repo: TeamRepository | None = None
    ):
        self.task_repo = task_repo
        self.team_repo = team_repo
        self.service = TaskService(task_repo)

    async def execute(
        self,
        task_id: UUID,
        actor_id: UUID | None = None,
        actor_role: str | None = None,
    ) -> None:
        task = await _get_active_task(self.task_repo, task_id)
        is_admin = actor_role is None or role_satisfies(
            actor_role, ("admin", "super_admin", "developer")
        )
        if not is_admin:
            await self._authorize_team_lead(task, actor_id)
        await self.service.delete_task(task_id)

    async def _authorize_team_lead(self, task, actor_id: UUID | None) -> None:
        if self.team_repo is None or actor_id is None or task.team_id is None:
            raise ForbiddenError("No tienes permiso para eliminar esta tarea")
        actor = await self.team_repo.get_member(task.team_id, actor_id)
        if actor is None or actor.team_role not in (
            TeamRole.LIDER,
            TeamRole.SUPERVISOR,
        ):
            raise ForbiddenError("No lideras el equipo de esta tarea")


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

    async def execute(
        self, task_id: UUID, work_item_id: UUID, actor_id: UUID | None = None
    ) -> TaskResponse:
        task = await _get_active_task(self.task_repo, task_id)
        work_item = await _get_work_item(self.work_tree_repo, work_item_id)
        if work_item.proyecto_id != task.project_id:
            raise ValidationError("El elemento pertenece a otro proyecto")

        previous = task.work_item_id
        updated = await self.task_repo.set_work_item(task, work_item_id)
        await TaskAuditor(self.task_repo, actor_id).location_changed(updated, previous)
        return TaskService._to_response(updated)


class DetachTaskUseCase:
    """Quita una tarea de la estructura; vuelve a quedar suelta en el proyecto."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(
        self, task_id: UUID, actor_id: UUID | None = None
    ) -> TaskResponse:
        task = await _get_active_task(self.task_repo, task_id)
        previous = task.work_item_id
        updated = await self.task_repo.set_work_item(task, None)
        await TaskAuditor(self.task_repo, actor_id).location_changed(updated, previous)
        return TaskService._to_response(updated)


class AddTaskDependencyUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(
        self, task_id: UUID, depends_on_id: UUID
    ) -> TaskDependencyResponse:
        return await self.service.add_dependency(task_id, depends_on_id)


class RemoveTaskDependencyUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(self, task_id: UUID, depends_on_id: UUID) -> None:
        await self.service.remove_dependency(task_id, depends_on_id)


class GetTaskDependenciesUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(self, task_id: UUID) -> list[TaskDependencyResponse]:
        return await self.service.list_dependencies(task_id)


class GetProjectTaskDependenciesUseCase:
    """Todas las dependencias FtS del proyecto en una sola llamada (cronograma)."""

    def __init__(self, task_repo: TaskRepository, project_repo: Repository):
        self.project_repo = project_repo
        self.service = TaskDependencyService(task_repo)

    async def execute(self, project_id: UUID) -> list[TaskDependencyResponse]:
        project = await self.project_repo.get_by_id(project_id)
        if not project or project.is_deleted:
            raise NotFoundError("El proyecto no existe")
        return await self.service.list_dependencies_by_project(project_id)


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
                requires_approval=task.requires_approval,
            )

        previous_status = task.status
        new_status = await self.service.change_status(task_id, data)

        # El historial se escribe SIEMPRE, tenga o no responsable la tarea:
        # notificar necesita a alguien a quien avisar, auditar no. Antes esto
        # colgaba del evento y una tarea sin asignar no dejaba rastro alguno.
        await TaskAuditor(self.task_repo, current_user_id).status_changed(
            task_id,
            previous_status,
            data.status,
            reason=data.change_reason,
        )

        # Los eventos de flujo sí asumen una tarea con responsable
        # (entrega/aprobación): sin él no hay a quién notificar.
        if self._bus and new_status.assignee_id:
            await self._emit_status_event(
                new_status, data.status, project_id, current_user_id
            )
        return new_status

    async def _authorize(
        self,
        current_user_id: UUID,
        assignee_id: UUID | None,
        project_id: UUID,
        new_status: TaskStatus,
        current_user_role: str | None = None,
        requires_approval: bool = True,
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

        # Tarea sin revisión obligatoria (`requires_approval=False`, el
        # default): el responsable entrega y la marca COMPLETADA él mismo, sin
        # pasar por el líder. DEVUELTA sigue siendo cosa del revisor: sin
        # revisión no hay a quién "devolver".
        if (
            is_assignee
            and not requires_approval
            and new_status == TaskStatus.COMPLETADA
        ):
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
        actor_id: UUID | None = None,
    ) -> None:
        assert task.assignee_id is not None
        now = datetime.now(timezone.utc)
        if new_status == TaskStatus.EN_PROGRESO:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskStarted(
                    task_id=task.id,
                    project_id=project_id,
                    assigned_id=task.assignee_id,
                    team_id=task.team_id,
                    actor_id=actor_id,
                    occurred_at=now,
                )
            )
        elif new_status == TaskStatus.EN_REVISION:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskSubmitted(
                    task_id=task.id,
                    work_item_id=project_id,
                    assigned_id=task.assignee_id,
                    project_id=project_id,
                    occurred_at=now,
                )
            )
        elif new_status == TaskStatus.COMPLETADA:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskCompleted(
                    task_id=task.id,
                    project_id=project_id,
                    assigned_id=task.assignee_id,
                    team_id=task.team_id,
                    actor_id=actor_id,
                    occurred_at=now,
                )
            )
        elif new_status == TaskStatus.DEVUELTA:
            await self._bus.publish(  # type: ignore[union-attr]
                TaskReturned(
                    task_id=task.id,
                    project_id=project_id,
                    assigned_id=task.assignee_id,
                    team_id=task.team_id,
                    occurred_at=now,
                )
            )
