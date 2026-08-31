from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    event_bus_dependency,
    project_repo_dependency,
    require_role,
    task_repo_dependency,
    worktree_repo_dependency,
)
from app.modules.project.structure.application.use_cases import (
    AddWorkItemDependencyUseCase,
    CloneWorkItemUseCase,
    CreateTipoNodoUseCase,
    CreateWorkItemUseCase,
    DeleteTipoNodoUseCase,
    DeleteWorkItemUseCase,
    ListTrashUseCase,
    RestoreWorkItemUseCase,
    GetWorkItemUseCase,
    GetWorkTreeUseCase,
    ListTiposNodoUseCase,
    ListWorkItemDependenciesUseCase,
    MoveWorkItemUseCase,
    RemoveWorkItemDependencyUseCase,
    ShiftWorkItemSubtreeUseCase,
    UpdateTipoNodoUseCase,
    UpdateWorkItemUseCase,
)
from app.modules.project.structure.presentation.schemas import (
    CloneWorkItemRequest,
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    MoveWorkItemRequest,
    ShiftWorkItemSubtreeRequest,
    TipoNodoResponse,
    TrashedItemResponse,
    UpdateTipoNodoRequest,
    UpdateWorkItemRequest,
    WorkItemDependencyRequest,
    WorkItemDependencyResponse,
    WorkItemResponse,
    WorkItemTreeResponse,
)

router = APIRouter(tags=["WorkTree"])

_admin = require_role("admin", "super_admin")
_any_user = require_role("admin", "super_admin", "user")


# ── Tipos de nodo ─────────────────────────────────────────────────────────────
@router.post(
    "/projects/{proyecto_id}/node-types",
    response_model=TipoNodoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_node_type(
    proyecto_id: UUID,
    data: CreateTipoNodoRequest,
    repo=Depends(worktree_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    _=Depends(_admin),
):
    return await CreateTipoNodoUseCase(repo, project_repo).execute(proyecto_id, data)


@router.get(
    "/projects/{proyecto_id}/node-types",
    response_model=list[TipoNodoResponse],
)
async def list_node_types(
    proyecto_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_any_user),
):
    return await ListTiposNodoUseCase(repo).execute(proyecto_id)


@router.patch("/node-types/{tipo_id}", response_model=TipoNodoResponse)
async def update_node_type(
    tipo_id: UUID,
    data: UpdateTipoNodoRequest,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    return await UpdateTipoNodoUseCase(repo).execute(tipo_id, data)


@router.delete("/node-types/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node_type(
    tipo_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    await DeleteTipoNodoUseCase(repo).execute(tipo_id)


# ── Nodos de trabajo ──────────────────────────────────────────────────────────
@router.post(
    "/projects/{proyecto_id}/work-items",
    response_model=WorkItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_work_item(
    proyecto_id: UUID,
    data: CreateWorkItemRequest,
    repo=Depends(worktree_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    current_user=Depends(_admin),
):
    return await CreateWorkItemUseCase(repo, project_repo).execute(proyecto_id, data)


@router.get(
    "/projects/{proyecto_id}/work-items",
    response_model=list[WorkItemTreeResponse],
)
async def get_work_tree(
    proyecto_id: UUID,
    repo=Depends(worktree_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    current_user=Depends(_any_user),
):
    return await GetWorkTreeUseCase(repo, project_repo).execute(proyecto_id)


@router.get("/work-items/{item_id}", response_model=WorkItemResponse)
async def get_work_item(
    item_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_any_user),
):
    return await GetWorkItemUseCase(repo).execute(item_id)


@router.patch("/work-items/{item_id}", response_model=WorkItemResponse)
async def update_work_item(
    item_id: UUID,
    data: UpdateWorkItemRequest,
    repo=Depends(worktree_repo_dependency),
    task_repo=Depends(task_repo_dependency),
    bus=Depends(event_bus_dependency),
    current_user=Depends(_admin),
):
    return await UpdateWorkItemUseCase(repo, task_repo, bus).execute(
        item_id, data, actor_id=current_user.id
    )


@router.delete("/work-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_item(
    item_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    await DeleteWorkItemUseCase(repo).execute(item_id)


@router.get("/projects/{proyecto_id}/trash", response_model=list[TrashedItemResponse])
async def list_trash(
    proyecto_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    """Papelera del proyecto: lo borrado que aún se puede recuperar.

    Borrar un elemento se lleva por delante todo su contenido, así que la
    papelera es la red de seguridad de esa operación.
    """
    return await ListTrashUseCase(repo).execute(proyecto_id)


@router.post("/work-items/{item_id}/restore", response_model=WorkItemResponse)
async def restore_work_item(
    item_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    """Saca un elemento de la papelera junto con todo lo que contenía."""
    return await RestoreWorkItemUseCase(repo).execute(item_id)


@router.post("/work-items/{item_id}/move", response_model=WorkItemResponse)
async def move_work_item(
    item_id: UUID,
    data: MoveWorkItemRequest,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    """Recoloca un nodo (drag & drop del árbol): nuevo padre y/o nuevo orden."""
    return await MoveWorkItemUseCase(repo).execute(
        item_id, data.new_parent_id, data.orden
    )


@router.post("/work-items/{item_id}/shift", response_model=WorkItemResponse)
async def shift_work_item_subtree(
    item_id: UUID,
    data: ShiftWorkItemSubtreeRequest,
    repo=Depends(worktree_repo_dependency),
    task_repo=Depends(task_repo_dependency),
    current_user=Depends(_admin),
):
    """Desplaza en el tiempo el subárbol completo (drag de la barra del nodo)."""
    return await ShiftWorkItemSubtreeUseCase(repo, task_repo).execute(
        item_id, data.offset_days, data.shift_tasks
    )


@router.post(
    "/work-items/{item_id}/clone",
    response_model=WorkItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clone_work_item(
    item_id: UUID,
    data: CloneWorkItemRequest,
    repo=Depends(worktree_repo_dependency),
    task_repo=Depends(task_repo_dependency),
    current_user=Depends(_admin),
):
    """Duplica el subárbol que cuelga del nodo bajo `target_parent_id`.

    Spec §9: desplaza fechas plan, resetea fechas reales y avance, preserva
    dependencias FtS internas al subárbol. Puede pegarse varias veces (`times`)
    y, con `include_tasks`, copia también las tareas con su responsable/equipo.
    """
    return await CloneWorkItemUseCase(repo, task_repo).execute(item_id, data)


# ── Dependencias Finish-to-Start ──────────────────────────────────────────────
@router.post(
    "/work-items/{item_id}/dependencies",
    response_model=WorkItemDependencyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_work_item_dependency(
    item_id: UUID,
    data: WorkItemDependencyRequest,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    return await AddWorkItemDependencyUseCase(repo).execute(item_id, data.depends_on_id)


@router.get(
    "/work-items/{item_id}/dependencies",
    response_model=list[WorkItemDependencyResponse],
)
async def list_work_item_dependencies(
    item_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_any_user),
):
    return await ListWorkItemDependenciesUseCase(repo).execute(item_id)


@router.delete(
    "/work-items/{item_id}/dependencies/{depends_on_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_work_item_dependency(
    item_id: UUID,
    depends_on_id: UUID,
    repo=Depends(worktree_repo_dependency),
    current_user=Depends(_admin),
):
    await RemoveWorkItemDependencyUseCase(repo).execute(item_id, depends_on_id)
