from typing import List, Union
from uuid import UUID

from fastapi import APIRouter, Depends
from starlette import status

from app.core.dependencies import (
    require_role,
    project_repo_dependency,
    project_node_repo_dependency,
    user_repo_dependency,
    project_members_repo_dependency,
)
from app.modules.project.application.use_cases import (
    CreateProjectNodeUseCase,
    DeleteProjectUseCase,
    GetProjectByIdUseCase,
    GetProjectsUseCase,
    UpdateProjectUseCase,
    CreateProjectUseCase,
    AddMemberToProjectUseCase,
    GetProjectMembersUseCase,
)
from app.modules.project.infrastructure.repository import (
    ProjectNodeRepository,
    ProjectRepository,
)
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    ProjectResponse,
    UpdateProjectRequest,
    CreateProjectNodeRequest,
    ProjectMemberRequest,
    ProjectMemberResponse,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: CreateProjectRequest,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    use_case = CreateProjectUseCase(repo=repo)
    return await use_case.execute(data)


@router.get("/", response_model=List[ProjectResponse], status_code=status.HTTP_200_OK)
async def get_all_projects(
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    use_case = GetProjectsUseCase(repo=repo)
    return await use_case.execute()


@router.get(
    "/{project_id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK
)
async def get_project_by_id(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    use_case = GetProjectByIdUseCase(repo=repo)
    return await use_case.execute(project_id)


@router.patch(
    "/{project_id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK
)
async def update_project(
    project_id: UUID,
    data: UpdateProjectRequest,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    use_case = UpdateProjectUseCase(repo=repo)
    return await use_case.execute(project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    repo=Depends(project_repo_dependency),
    current_user=Depends(require_role("super_admin")),
):
    use_case = DeleteProjectUseCase(repo=repo)
    await use_case.execute(project_id)


# --- ENDPOINTS PARA NODOS ---


@router.post("/nodes", status_code=status.HTTP_201_CREATED)
async def create_project_node(
    data: Union[List[CreateProjectNodeRequest], CreateProjectNodeRequest],
    project_node_repo: ProjectNodeRepository = Depends(project_node_repo_dependency),
    project_repo: ProjectRepository = Depends(project_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    use_case = CreateProjectNodeUseCase(
        project_repo=project_repo,
        node_repo=project_node_repo,
    )
    return await use_case.execute(data)


# --- ENDPOINTS PARA PROJECT MEMBERS ---


@router.post("/members/", status_code=status.HTTP_201_CREATED)
async def add_project_member(
    payload: ProjectMemberRequest,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    return await AddMemberToProjectUseCase(
        user_repo=user_repo,
        member_repo=project_member_repo,
        project_repo=project_repo,
    ).execute(payload)


@router.get(
    "/{project_id}/members",
    response_model=List[ProjectMemberResponse],
    status_code=status.HTTP_200_OK,
)
async def get_project_members(
    project_id: UUID,
    project_repo=Depends(project_repo_dependency),
    user_repo=Depends(user_repo_dependency),
    project_member_repo=Depends(project_members_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin", "user")),
):
    use_case = GetProjectMembersUseCase(
        project_repo=project_repo,
        user_repo=user_repo,
        member_repo=project_member_repo,
    )

    return await use_case.execute(project_id)
