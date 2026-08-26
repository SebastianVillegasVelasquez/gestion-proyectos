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
    user_repo_dependency,
    worktree_repo_dependency,
)
from app.modules.tasks.application.use_cases import (
    AddTaskDependencyUseCase,
    AttachTaskToWorkItemUseCase,
    ChangeTaskStatusUseCase,
    CreateTaskUseCase,
    CreateTasksFromBranchUseCase,
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
    CreateTaskRequest,
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
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    bus: EventBus = Depends(event_bus_dependency),
):
    return await CreateTaskUseCase(
        task_repo, work_tree_repo, user_repo, project_repo, bus
    ).execute(payload)


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
    current_user=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    user_repo=Depends(user_repo_dependency),
):
    return await UpdateTaskUseCase(task_repo, user_repo).execute(task_id, payload)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
):
    await DeleteTaskUseCase(task_repo).execute(task_id)


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
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
    work_tree_repo=Depends(worktree_repo_dependency),
):
    """Adjunta una tarea (suelta o ya adjunta) al elemento indicado."""
    return await AttachTaskToWorkItemUseCase(task_repo, work_tree_repo).execute(
        task_id, payload.work_item_id
    )


@router.patch("/tasks/{task_id}/detach", response_model=TaskResponse)
async def detach_task(
    task_id: UUID,
    _=Depends(_admin),
    task_repo=Depends(task_repo_dependency),
):
    """Quita la tarea de la estructura; vuelve a quedar suelta."""
    return await DetachTaskUseCase(task_repo).execute(task_id)
