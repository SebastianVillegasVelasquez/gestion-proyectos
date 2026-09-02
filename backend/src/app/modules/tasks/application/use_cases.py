from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.domain import rules
from app.modules.tasks.domain.audit import TaskAuditor, snapshot
from app.modules.tasks.domain.services import (
    TaskDependencyService,
    TaskService,
    TaskStatusService,
    progress_by_id,
    reschedule_task_start,
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
    MyTaskItemResponse,
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
    TaskChainRescheduled,
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

        # Duración SIN inicio: se ancla al arranque del proyecto (igual que un
        # componente «sin fecha, con duración»). Si el proyecto tampoco tiene
        # fecha, la tarea queda solo con su estimación.
        if data.duration_days is not None and data.start_date is None:
            project = await self.project_repo.get_by_id(data.project_id)
            project_start = getattr(project, "start_date", None) if project else None
            if project_start is not None:
                from datetime import timedelta

                data.start_date = project_start
                data.due_date = project_start + timedelta(days=data.duration_days)

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
                created.id, depends_on_id=data.depends_on_id
            )
        if data.depends_on_work_item_id is not None:
            await TaskDependencyService(self.task_repo).add_dependency(
                created.id, depends_on_work_item_id=data.depends_on_work_item_id
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
                depends_on_work_item_id=data.depends_on_work_item_id,
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
    """Apunta días dedicados a una tarea.

    Cualquiera que trabaje en la tarea puede apuntar SU esfuerzo: el apunte
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
                days=data.days,
                work_date=data.work_date,
                notes=data.notes,
            )
        )
        return TimeEntryResponse(
            id=entry.id,
            task_id=entry.task_id,
            user_id=entry.user_id,
            days=entry.days,
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
                days=entry.days,
                work_date=entry.work_date,
                notes=entry.notes,
                created_at=entry.created_at,
            )
            for entry, name, last_name in rows
        ]
        return TaskEffortResponse(
            task_id=task_id,
            estimated_days=task.estimated_days,
            logged_days=sum((e.days for e in entries), Decimal("0")),
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


def _blocking_by_task(deps) -> dict[UUID, list[BlockingTaskResponse]]:
    """Agrupa dependencias FtS por `task_id` en `BlockingTaskResponse` (id +
    título + estado), resolviendo tanto tarea→tarea como tarea→elemento. Fuente
    única del `blocked_by` del workspace y de «Mis tareas»."""
    blocking: dict[UUID, list[BlockingTaskResponse]] = {}
    for dep in deps:
        if dep.depends_on_work_item_id is not None:
            wi = dep.depends_on_work_item
            blocking.setdefault(dep.task_id, []).append(
                BlockingTaskResponse(
                    id=dep.depends_on_work_item_id,
                    title=(wi.nombre if wi is not None else "Elemento"),
                    status=(
                        TaskStatus.COMPLETADA
                        if rules.work_item_is_done(wi)
                        else TaskStatus.PENDIENTE_POR_INICIAR
                    ),
                )
            )
            continue
        if dep.depends_on is None:
            continue
        blocking.setdefault(dep.task_id, []).append(
            BlockingTaskResponse(
                id=dep.depends_on.id,
                title=dep.depends_on.title,
                status=dep.depends_on.status or TaskStatus.PENDIENTE_POR_INICIAR,
            )
        )
    return blocking


class GetTasksByTeamUseCase:
    """Tareas delegadas a un equipo (read model del espacio de trabajo).

    Devuelve cada tarea con su módulo, proyecto y responsable ya resueltos, para
    que el workspace las agrupe por módulo ("Módulo 1", …) sin pedir el árbol.
    """

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, team_id: UUID) -> list[TeamTaskItemResponse]:
        rows = await self.task_repo.get_by_team(team_id)
        progress = progress_by_id([row[0] for row in rows])

        # Dos consultas en total (tareas + dependencias), no una por tarea.
        deps = await self.task_repo.get_dependencies_by_team(team_id)
        blocking = _blocking_by_task(deps)
        third_party = {
            dep.task_id
            for dep in deps
            if dep.depends_on_work_item_id is not None
            and rules.is_third_party_tipo(
                getattr(dep.depends_on_work_item, "tipo", None)
            )
        }

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
                progress_pct=progress.get(task.id, 0),
                blocked_by=blocking.get(task.id, []),
                depends_on_third_party=task.id in third_party,
            )
            for task, work_item_name, project_id, project_name, assignee_name in rows
        ]


class GetMyTasksUseCase:
    """«Mis tareas»: todo lo asignado al usuario, de cualquier proyecto, con el
    proyecto / elemento / equipo ya resueltos para la lista."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(self, user_id: UUID) -> list[MyTaskItemResponse]:
        rows = await self.task_repo.get_assigned_to_user(user_id)
        tasks = [row[0] for row in rows]
        # `progress_by_id` haría el rollup si tuviéramos padre e hijas juntas,
        # pero «Mis tareas» solo trae lo asignado a la persona. Para las padre
        # cuyas subtareas no están en la lista se usa el avance por estado; la
        # cifra fina del entregable vive en la vista de proyecto / equipo.
        rollup = progress_by_id(tasks)

        # Dependencias FtS de todas mis tareas en UNA consulta.
        deps = await self.task_repo.get_dependencies_by_tasks([t.id for t in tasks])
        deps_by_task: dict[UUID, list] = {}
        for dep in deps:
            deps_by_task.setdefault(dep.task_id, []).append(dep)
        blocking = _blocking_by_task(deps)
        third_party = {
            dep.task_id
            for dep in deps
            if dep.depends_on_work_item_id is not None
            and rules.is_third_party_tipo(
                getattr(dep.depends_on_work_item, "tipo", None)
            )
        }

        # Compuerta «actividad de terceros» ancestro: se camina por work_item
        # DISTINTO, memoizado. Los árboles son poco profundos → coste acotado
        # (K caminatas, no un N+1 sobre el nº de tareas).
        tp_ancestor: dict[UUID, bool] = {}
        for wi_id in {t.work_item_id for t in tasks if t.work_item_id is not None}:
            tp_ancestor[
                wi_id
            ] = await self.task_repo.has_undelivered_third_party_ancestor(wi_id)

        _terminal = (TaskStatus.COMPLETADA, TaskStatus.CANCELADA)
        out: list[MyTaskItemResponse] = []
        for task, work_item_name, project_name, team_name in rows:
            task_deps = deps_by_task.get(task.id, [])
            has_tp_ancestor = task.work_item_id is not None and tp_ancestor.get(
                task.work_item_id, False
            )
            # El motivo de bloqueo solo tiene sentido para algo aún entregable.
            blocked_reason = (
                None
                if task.status in _terminal
                else rules.delivery_block_reason(task_deps, has_tp_ancestor)
            )
            out.append(
                MyTaskItemResponse(
                    id=task.id,
                    title=task.title,
                    status=task.status or TaskStatus.PENDIENTE_POR_INICIAR,
                    priority=task.priority,
                    project_id=task.project_id,
                    project_name=project_name,
                    work_item_id=task.work_item_id,
                    work_item_name=work_item_name,
                    team_id=task.team_id,
                    team_name=team_name,
                    parent_task_id=task.parent_task_id,
                    start_date=task.start_date,
                    due_date=task.due_date,
                    requires_approval=task.requires_approval,
                    progress_pct=rollup.get(task.id, 0),
                    estimated_days=task.estimated_days,
                    delivery_blocked_reason=blocked_reason,
                    depends_on_third_party=task.id in third_party,
                    blocked_by=blocking.get(task.id, []),
                )
            )
        return out


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

        # Movida la fecha de entrega → «la fecha fin de la dependencia es el
        # inicio de la que depende»: empujamos en cadena a las dependientes.
        if (
            "due_date" in data.model_dump(exclude_unset=True)
            and updated.due_date is not None
        ):
            await cascade_reschedule_dependents(
                self.task_repo,
                self._bus,
                source_id=updated.id,
                source_title=updated.title,
                project_id=project_id or updated.project_id,
                anchor=updated.due_date,
                actor_id=actor_id,
            )

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
    "estimated_days",
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


class PromoteWorkItemToTaskUseCase:
    """Convierte un elemento de la estructura en una tarea asignable SIN dejar
    de ser un contenedor: crea una única tarea enlazada 1:1 con él
    (`represents_work_item`), con su mismo nombre. Idempotente: si el elemento
    ya es una tarea, devuelve la que hay.
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
        self.user_repo = user_repo
        self.project_repo = project_repo
        self._bus = bus

    async def execute(
        self, work_item_id: UUID, actor_id: UUID | None = None
    ) -> TaskResponse:
        work_item = await _get_work_item(self.work_tree_repo, work_item_id)

        existing = await self.task_repo.get_representing_task(work_item_id)
        if existing is not None:
            return TaskService._to_response(
                existing, await self.task_repo.logged_days(existing.id)
            )

        return await CreateTaskUseCase(
            self.task_repo,
            self.work_tree_repo,
            self.user_repo,
            self.project_repo,
            self._bus,
        ).execute(
            CreateTaskRequest(
                title=work_item.nombre,
                work_item_id=work_item_id,
                represents_work_item=True,
            ),
            actor_id=actor_id,
        )


class DemoteWorkItemTaskUseCase:
    """Deshace la conversión: borra (lógico) la tarea que representa al elemento
    y, en cascada, sus subtareas. El elemento sigue en la estructura."""

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo
        self.service = TaskService(task_repo)

    async def execute(self, work_item_id: UUID, actor_id: UUID | None = None) -> None:
        task = await self.task_repo.get_representing_task(work_item_id)
        if task is None:
            raise NotFoundError("El elemento no es una tarea")
        await self.service.delete_task(task.id)


class ReorderTaskUseCase:
    """Recoloca una tarea entre sus hermanas (mismo elemento y misma tarea
    padre). El resultado es un `orden` 0,1,2… sin huecos para todo el grupo.

    Solo cambia la prioridad / orden de cumplimiento; fechas y dependencias no
    se tocan (para eso está el cronograma y las dependencias FtS).
    """

    def __init__(self, task_repo: TaskRepository):
        self.task_repo = task_repo

    async def execute(
        self, task_id: UUID, after_id: UUID | None = None
    ) -> TaskResponse:
        task = await _get_active_task(self.task_repo, task_id)
        if after_id == task_id:
            raise ValidationError("Una tarea no puede ir después de sí misma")

        siblings = await self.task_repo.get_siblings_in_order(task)
        others = [s for s in siblings if s.id != task_id]

        if after_id is None:
            ordered = [task, *others]
        else:
            ref_index = next(
                (i for i, s in enumerate(others) if s.id == after_id), None
            )
            if ref_index is None:
                raise ValidationError("La tarea de referencia no es hermana de esta")
            ordered = [
                *others[: ref_index + 1],
                task,
                *others[ref_index + 1 :],
            ]

        await self.task_repo.renumber(ordered)
        refreshed = await _get_active_task(self.task_repo, task_id)
        return TaskService._to_response(refreshed)


class AddTaskDependencyUseCase:
    def __init__(self, task_repo: TaskRepository):
        self.service = TaskDependencyService(task_repo)

    async def execute(
        self,
        task_id: UUID,
        depends_on_id: UUID | None = None,
        depends_on_work_item_id: UUID | None = None,
    ) -> TaskDependencyResponse:
        return await self.service.add_dependency(
            task_id,
            depends_on_id=depends_on_id,
            depends_on_work_item_id=depends_on_work_item_id,
        )


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


async def cascade_reschedule_dependents(
    task_repo: TaskRepository,
    bus: EventBus | None,
    *,
    source_id: UUID,
    source_title: str,
    project_id: UUID,
    anchor,
    actor_id: UUID | None,
    _seen: set[UUID] | None = None,
) -> None:
    """Cascada de fechas finish-to-start: empuja el inicio de todo lo que
    depende de `source_id` a `anchor` (su fecha de fin), en cadena, y avisa a
    los responsables afectados. Se dispara cuando el predecesor se completa
    (`ChangeTaskStatusUseCase`, entrega/aprobación en el módulo de equipos) y
    cuando le mueven la fecha de entrega (`UpdateTaskUseCase`): en todos los
    casos «la fecha fin de la dependencia pasa a ser el inicio de la que
    depende» y el fin de esta se recalcula con sus días estimados.

    `_seen` corta ciclos de dependencias: cada tarea se reprograma una sola vez
    por cascada.
    """
    if anchor is None:
        return
    if _seen is None:
        _seen = set()
    dependents = await task_repo.get_dependents(source_id)
    if not dependents:
        return

    changed: list = []
    for dep in dependents:
        if dep.id in _seen:
            continue
        if dep.status in (TaskStatus.COMPLETADA, TaskStatus.CANCELADA):
            continue
        _seen.add(dep.id)
        before = snapshot(dep)
        if reschedule_task_start(dep, anchor, recompute_due_from_estimate=True):
            await task_repo.save(dep)
            await TaskAuditor(task_repo, actor_id).diff(before, dep)
            changed.append(dep)
            # En cadena: si una dependiente se movió, sus propias dependientes
            # arrancan tras su nuevo fin.
            if dep.due_date is not None:
                await cascade_reschedule_dependents(
                    task_repo,
                    bus,
                    source_id=dep.id,
                    source_title=dep.title,
                    project_id=project_id,
                    anchor=dep.due_date,
                    actor_id=actor_id,
                    _seen=_seen,
                )

    if changed and bus is not None:
        recipients = tuple(
            {d.assignee_id for d in changed if d.assignee_id is not None}
        )
        await bus.publish(
            TaskChainRescheduled(
                project_id=project_id,
                trigger_kind="task",
                trigger_name=source_title,
                new_start=anchor,
                task_ids=tuple(d.id for d in changed),
                recipient_ids=recipients,
                actor_id=actor_id,
                occurred_at=datetime.now(timezone.utc),
            )
        )


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

        # Cascada de fechas: al completar una tarea, sus dependientes arrancan
        # en la fecha de fin de esta y se avisa a sus responsables.
        if data.status == TaskStatus.COMPLETADA:
            await self._cascade_reschedule_dependents(new_status, current_user_id)

        # La tarea padre ya no se "comienza" a mano: cuando arranca su primera
        # subtarea, sube ella sola a EN_PROGRESO para que su estado no siga
        # diciendo "pendiente" mientras el trabajo ya empezó.
        if data.status == TaskStatus.EN_PROGRESO and task.parent_task_id is not None:
            await self._advance_parent_to_in_progress(
                task.parent_task_id, current_user_id
            )
        return new_status

    async def _advance_parent_to_in_progress(
        self, parent_id: UUID, actor_id: UUID | None
    ) -> None:
        parent = await self.task_repo.get_by_id(parent_id)
        if parent is None or parent.is_deleted:
            return
        if parent.status != TaskStatus.PENDIENTE_POR_INICIAR:
            return
        previous = parent.status
        try:
            await self.service.change_status(
                parent_id, UpdateTaskStatusRequest(status=TaskStatus.EN_PROGRESO)
            )
        except (ValidationError, NotFoundError):
            # El padre no puede avanzar todavía (p. ej. cuelga de una actividad
            # de terceros sin entregar): no es motivo para tumbar el arranque de
            # la subtarea.
            return
        await TaskAuditor(self.task_repo, actor_id).status_changed(
            parent_id, previous, TaskStatus.EN_PROGRESO, reason="Subtarea iniciada"
        )

    async def _cascade_reschedule_dependents(
        self, completed: TaskResponse, actor_id: UUID | None
    ) -> None:
        anchor = completed.due_date or (
            completed.completed_at.date() if completed.completed_at else None
        )
        await cascade_reschedule_dependents(
            self.task_repo,
            self._bus,
            source_id=completed.id,
            source_title=completed.title,
            project_id=completed.project_id,
            anchor=anchor,
            actor_id=actor_id,
        )

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
