from fastapi import Depends
from fastapi.routing import APIRouter

from app.core.dependencies import repo_dependency
from app.modules.identity.application.use_cases import CreateUserUseCase
from app.modules.identity.presentation.schemas import CreateUserRequest
from app.shared.base_repository import UserRepository

router = APIRouter(prefix="/identity", tags=["Identity"])


@router.post("/")
async def create(
    data: CreateUserRequest,
    repo: UserRepository = Depends(repo_dependency),
):
    return await CreateUserUseCase(user_repo=repo).execute(data)
