from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    phase_repo_dependency,
    task_repo_dependency,
    require_project_permission,
    project_node_repo_dependency,
    user_repo_dependency,
    project_repo_dependency,
)
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.tasks.application.use_cases import (
    AddTaskDependencyUseCase,
    ChangeTaskStatusUseCase,
    CreateTaskUseCase,
    GetTaskDependenciesUseCase,
    GetTasksByNodeUseCase,
    GetTasksByProjectUseCase,
    GetTaskByIdUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
)
from app.modules.tasks.presentation.schemas import (
    CreateTaskDependencyRequest,
    TaskDependencyResponse,
    TaskResponse,
    CreateTaskRequest,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_general(
    project_id: UUID,
    payload: CreateTaskRequest,
    current_user=Depends(require_project_permission(ProjectRole.COORDINADOR)),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
    phase_repo=Depends(phase_repo_dependency),
):
    use_case = CreateTaskUseCase(
        task_repo, project_repo, user_repo, project_node_repo, phase_repo
    )
    return await use_case.execute(project_id=project_id, data=payload)


@router.get(
    "/{project_id}/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
)
async def get_project_tasks(
    project_id: UUID,
    current_user=Depends(
        require_project_permission(
            ProjectRole.COORDINADOR,
            ProjectRole.INTEGRANTE,
            ProjectRole.SUPERVISOR,
            ProjectRole.REVISOR,
        )
    ),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
):
    use_case = GetTasksByProjectUseCase(task_repo, project_repo)
    return await use_case.execute(project_id=project_id)


@router.post(
    "/{project_id}/nodes/{node_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    project_id: UUID,
    node_id: UUID,
    payload: CreateTaskRequest,
    current_user=Depends(require_project_permission(ProjectRole.COORDINADOR)),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
    phase_repo=Depends(phase_repo_dependency),
):
    payload.node_id = node_id
    payload.phase_id = None
    use_case = CreateTaskUseCase(
        task_repo, project_repo, user_repo, project_node_repo, phase_repo
    )
    return await use_case.execute(project_id=project_id, data=payload)


@router.get(
    "/{project_id}/nodes/{node_id}/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
)
async def get_tasks_by_node(
    project_id: UUID,
    node_id: UUID,
    current_user=Depends(
        require_project_permission(
            ProjectRole.COORDINADOR,
            ProjectRole.INTEGRANTE,
            ProjectRole.SUPERVISOR,
            ProjectRole.REVISOR,
        )
    ),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
):
    use_case = GetTasksByNodeUseCase(task_repo, project_repo, project_node_repo)
    return await use_case.execute(project_id=project_id, node_id=node_id)


@router.get(
    "/{project_id}/nodes/{node_id}/tasks/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def get_task_by_id(
    project_id: UUID,
    node_id: UUID,
    task_id: UUID,
    current_user=Depends(
        require_project_permission(
            ProjectRole.COORDINADOR,
            ProjectRole.INTEGRANTE,
            ProjectRole.SUPERVISOR,
            ProjectRole.REVISOR,
        )
    ),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
):
    use_case = GetTaskByIdUseCase(task_repo, project_repo, project_node_repo)
    return await use_case.execute(
        project_id=project_id, node_id=node_id, task_id=task_id
    )


@router.patch(
    "/{project_id}/nodes/{node_id}/tasks/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def update_task(
    project_id: UUID,
    node_id: UUID,
    task_id: UUID,
    payload: UpdateTaskRequest,
    current_user=Depends(require_project_permission(ProjectRole.COORDINADOR)),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
):
    use_case = UpdateTaskUseCase(task_repo, project_repo, user_repo, project_node_repo)
    return await use_case.execute(
        project_id=project_id, node_id=node_id, task_id=task_id, data=payload
    )


@router.delete(
    "/{project_id}/nodes/{node_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_task(
    project_id: UUID,
    node_id: UUID,
    task_id: UUID,
    current_user=Depends(require_project_permission(ProjectRole.COORDINADOR)),
    task_repo=Depends(task_repo_dependency),
    project_repo=Depends(project_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
):
    use_case = DeleteTaskUseCase(task_repo, project_repo, project_node_repo)
    await use_case.execute(project_id=project_id, node_id=node_id, task_id=task_id)


# --- DEPENDENCIAS Y CAMBIO DE ESTADO ---


@router.post(
    "/{project_id}/tasks/{task_id}/dependencies",
    response_model=TaskDependencyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_task_dependency(
    project_id: UUID,
    task_id: UUID,
    payload: CreateTaskDependencyRequest,
    current_user=Depends(
        require_project_permission(ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR)
    ),
    task_repo=Depends(task_repo_dependency),
):
    use_case = AddTaskDependencyUseCase(task_repo)
    return await use_case.execute(task_id=task_id, depends_on_id=payload.depends_on_id)


@router.get(
    "/{project_id}/tasks/{task_id}/dependencies",
    response_model=List[TaskDependencyResponse],
    status_code=status.HTTP_200_OK,
)
async def get_task_dependencies(
    project_id: UUID,
    task_id: UUID,
    current_user=Depends(
        require_project_permission(
            ProjectRole.COORDINADOR,
            ProjectRole.INTEGRANTE,
            ProjectRole.SUPERVISOR,
            ProjectRole.REVISOR,
        )
    ),
    task_repo=Depends(task_repo_dependency),
):
    use_case = GetTaskDependenciesUseCase(task_repo)
    return await use_case.execute(task_id=task_id)


@router.patch(
    "/{project_id}/tasks/{task_id}/status",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
)
async def change_task_status(
    project_id: UUID,
    task_id: UUID,
    payload: UpdateTaskStatusRequest,
    current_user=Depends(
        require_project_permission(
            ProjectRole.COORDINADOR, ProjectRole.INTEGRANTE, ProjectRole.REVISOR
        )
    ),
    task_repo=Depends(task_repo_dependency),
    project_node_repo=Depends(project_node_repo_dependency),
    phase_repo=Depends(phase_repo_dependency),
):
    use_case = ChangeTaskStatusUseCase(task_repo, project_node_repo, phase_repo)
    return await use_case.execute(task_id=task_id, data=payload)
