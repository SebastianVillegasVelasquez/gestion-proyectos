# from fastapi import APIRouter, Depends
#
# from app.core.dependencies import require_role, ProjectRepositories, get_project_repos
# from app.modules.project.application.use_cases import CreateProjectUseCase
# from app.modules.project.presentation.schemas import ProjectCreateRequest
#
# router = APIRouter(prefix="/projects", tags=["Projects"])
#
#
# @router.post("/")
# async def create_project(
#         data: ProjectCreateRequest,
#         project_dependency: ProjectRepositories = Depends(get_project_repos),
#         current_user=Depends(require_role("admin", "super_admin"))
# ):
#     use_case = CreateProjectUseCase(
#         project_repo_dependencies=project_dependency
#     )
#
#     await use_case.execute(data)
