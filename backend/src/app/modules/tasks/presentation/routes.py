from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    event_bus_dependency,
    get_current_user,
    project_members_repo_dependency,
    project_repo_dependency,
    require_role,
    task_repo_dependency,
    team_repo_dependency,
    user_repo_dependency,
    worktree_repo_dependency,
)
from app.modules.tasks.application.use_cases import (
    AddTaskDependencyUseCase,
    RemoveTaskDependencyUseCase,
    AttachTaskToWorkItemUseCase,
    ChangeTaskStatusUseCase,
    CreateTaskUseCase,
    CreateTeamTaskUseCase,
    AddCommentUseCase,
    CreateTasksFromBranchUseCase,
    DeleteCommentUseCase,
    DeleteTimeEntryUseCase,
    GetTaskEffortUseCase,
    ListCommentsUseCase,
    LogTimeUseCase,
    DeleteTaskUseCase,
    DetachTaskUseCase,
    GetProjectTaskDependenciesUseCase,
    GetTaskByIdUseCase,
    GetTaskDependenciesUseCase,
    GetTasksByProjectUseCase,
    GetTasksByTeamUseCase,
    GetTasksByWorkItemUseCase,
    UpdateTaskUseCase,
)
from app.modules.tasks.presentation.schemas import (
    AttachTaskRequest,
    CreateTaskDependencyRequest,
    BulkTasksFromBranchRequest,
    BulkTasksResultResponse,
    CommentResponse,
    CreateCommentRequest,
    CreateTaskRequest,
    CreateTeamTaskRequest,
    CreateTimeEntryRequest,
    TaskEffortResponse,
    TimeEntryResponse,
    TaskDependencyResponse,
    TaskResponse,
    TeamTaskItemResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)
from app.shared.events import EventBus

router = APIRouter(tags=["Tasks"])

_admin = require_role("admin", "super_admin")
_any_user = require_role("admin", "super_admin", "user")


# ── Tareas ────────────────────────────────────────────────────────────────────
@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: CreateTaskRequest,
    current_user=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    return await CreateTaskUseCase(
        task_repo, work_tree_repo, user_repo, project_repo, bus
    ).execute(payload, actor_id=current_user.id)


@router.post(
    "/work-items/{item_id}/tasks/bulk",
    response_model=BulkTasksResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tasks_from_branch(
    item_id: UUID,
    payload: BulkTasksFromBranchRequest,
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    """Crea una tarea por cada elemento de la rama que cuelga de `item_id`.

    Pensado para montar de golpe el trabajo de una unidad completa. Los
    elementos que ya tienen tarea se saltan (no se duplican), así que se puede
    relanzar sobre la misma rama para crear solo lo que falta.
    """
    return await CreateTasksFromBranchUseCase(
        task_repo, work_tree_repo, user_repo, project_repo, bus
    ).execute(item_id, payload)


# ── Comentarios y menciones ───────────────────────────────────────────────────
@router.post(
    "/tasks/{task_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    task_id: UUID,
    payload: CreateCommentRequest,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    """Comenta una tarea. Los mencionados y el responsable reciben aviso."""
    return await AddCommentUseCase(task_repo, bus).execute(
        task_id, current_user.id, payload
    )


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Conversación de la tarea, del comentario más antiguo al más nuevo."""
    return await ListCommentsUseCase(task_repo).execute(task_id)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Borra un comentario propio (o cualquiera si administras)."""
    await DeleteCommentUseCase(task_repo).execute(
        comment_id, current_user.id, current_user.role
    )


# ── Esfuerzo: estimación vs. días dedicados ───────────────────────────────────
@router.post(
    "/tasks/{task_id}/time-entries",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_time(
    task_id: UUID,
    payload: CreateTimeEntryRequest,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Apunta días dedicados a una tarea, a nombre de quien los apunta.

    No se registra tiempo por otra persona: el dato solo sirve para estimar y
    para pagar si quien lo escribe es quien lo trabajó.
    """
    return await LogTimeUseCase(task_repo).execute(task_id, current_user.id, payload)


@router.get("/tasks/{task_id}/effort", response_model=TaskEffortResponse)
async def get_task_effort(
    task_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Estimado vs. dedicado de una tarea, con el detalle de los apuntes."""
    return await GetTaskEffortUseCase(task_repo).execute(task_id)


@router.delete("/time-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_entry(
    entry_id: UUID,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Borra un apunte de esfuerzo (solo el propio, o cualquiera si administras)."""
    await DeleteTimeEntryUseCase(task_repo).execute(
        entry_id, current_user.id, current_user.role
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    return await GetTaskByIdUseCase(task_repo).execute(task_id)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    payload: UpdateTaskRequest,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    team_repo=Depends(team_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    """Editar una tarea es de administración; la excepción es que el
    líder/supervisor de un equipo reasigne una tarea delegada a él entre sus
    integrantes (ver `UpdateTaskUseCase`)."""
    return await UpdateTaskUseCase(task_repo, user_repo, team_repo, bus).execute(
        task_id, payload, actor_id=current_user.id, actor_role=current_user.role
    )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    team_repo=Depends(team_repo_dependency),
):
    """Administración, o el líder/supervisor de SU equipo (ver `DeleteTaskUseCase`)."""
    await DeleteTaskUseCase(task_repo, team_repo).execute(
        task_id, actor_id=current_user.id, actor_role=current_user.role
    )


# ── Listados ─────────────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/tasks", response_model=list[TaskResponse])
async def get_project_tasks(
    project_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
):
    return await GetTasksByProjectUseCase(task_repo, project_repo).execute(project_id)


@router.get("/work-items/{work_item_id}/tasks", response_model=list[TaskResponse])
async def get_work_item_tasks(
    work_item_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
):
    return await GetTasksByWorkItemUseCase(task_repo, work_tree_repo).execute(
        work_item_id
    )


@router.get("/teams/{team_id}/tasks", response_model=list[TeamTaskItemResponse])
async def get_team_tasks(
    team_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    """Tareas delegadas a un equipo, con módulo y responsable (espacio de trabajo)."""
    return await GetTasksByTeamUseCase(task_repo).execute(team_id)


@router.post(
    "/teams/{team_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_task(
    team_id: UUID,
    payload: CreateTeamTaskRequest,
    current_user=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    team_repo=Depends(team_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    """El líder o supervisor de un equipo crea una tarea de SU equipo: bolsa
    (sin responsable) o ya asignada a un integrante, colgada de un elemento y/o
    subtarea de otra. El proyecto sale del equipo, no del cuerpo."""
    return await CreateTeamTaskUseCase(
        task_repo, work_tree_repo, user_repo, project_repo, team_repo, bus
    ).execute(team_id, payload, actor_id=current_user.id)


# ── Dependencias y estado ────────────────────────────────────────────────────
@router.post(
    "/tasks/{task_id}/dependencies",
    response_model=TaskDependencyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_task_dependency(
    task_id: UUID,
    payload: CreateTaskDependencyRequest,
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
):
    return await AddTaskDependencyUseCase(task_repo).execute(
        task_id, payload.depends_on_id
    )


@router.delete(
    "/tasks/{task_id}/dependencies/{depends_on_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_task_dependency(
    task_id: UUID,
    depends_on_id: UUID,
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
):
    """Quita una dependencia FtS de la tarea (edición posterior a la creación)."""
    await RemoveTaskDependencyUseCase(task_repo).execute(task_id, depends_on_id)


@router.get(
    "/tasks/{task_id}/dependencies", response_model=list[TaskDependencyResponse]
)
async def list_task_dependencies(
    task_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
):
    return await GetTaskDependenciesUseCase(task_repo).execute(task_id)


@router.get(
    "/projects/{project_id}/task-dependencies",
    response_model=list[TaskDependencyResponse],
)
async def list_project_task_dependencies(
    project_id: UUID,
    _=Depends(_any_user),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
):
    """Todas las dependencias FtS del proyecto, para dibujarlas en el cronograma."""
    return await GetProjectTaskDependenciesUseCase(task_repo, project_repo).execute(
        project_id
    )


@router.patch("/tasks/{task_id}/status", response_model=TaskResponse)
async def change_task_status(
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    bus: EventBus = Depends(event_bus_dependency),
    current_user=Depends(get_current_user),
    task_repo=Depends(task_repo_dependency),
    member_repo=Depends(project_members_repo_dependency),
):
    """El responsable entrega y el líder aprueba o devuelve. Ver
    `ChangeTaskStatusUseCase` para el detalle del flujo."""
    return await ChangeTaskStatusUseCase(task_repo, member_repo, bus).execute(
        task_id,
        payload,
        current_user_id=current_user.id,
        current_user_role=current_user.role,
    )


# ── Estructura: adjuntar / quitar una tarea de un elemento ─────────────────────
@router.patch("/tasks/{task_id}/attach", response_model=TaskResponse)
async def attach_task(
    task_id: UUID,
    payload: AttachTaskRequest,
    current_user=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
):
    """Adjunta una tarea (suelta o ya adjunta) al elemento indicado."""
    return await AttachTaskToWorkItemUseCase(task_repo, work_tree_repo).execute(
        task_id, payload.work_item_id, actor_id=current_user.id
    )


@router.patch("/tasks/{task_id}/detach", response_model=TaskResponse)
async def detach_task(
    task_id: UUID,
    current_user=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
):
    """Quita la tarea de la estructura; vuelve a quedar suelta."""
    return await DetachTaskUseCase(task_repo).execute(task_id, actor_id=current_user.id)
