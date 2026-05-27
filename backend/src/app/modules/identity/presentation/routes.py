from fastapi import Depends
from fastapi.routing import APIRouter

from app.core.dependencies import repo_dependency, get_current_user, require_role
from app.modules.identity.application.use_cases import CreateUserUseCase, LoginUseCase
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.shared.base_repository import UserRepository
from app.shared.exceptions import ForbiddenError

router = APIRouter(prefix="/identity", tags=["Identity"])


@router.post("/", response_model=UserResponse, status_code=201)
async def create(
    data: CreateUserRequest,
    repo: UserRepository = Depends(repo_dependency),
):
    return await CreateUserUseCase(user_repo=repo).execute(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    repo: UserRepository = Depends(repo_dependency),
):
    return await LoginUseCase(repo).execute(data.email, data.password)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def get_users(
    repo: UserRepository = Depends(repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    if current_user.role != "admin":
        raise ForbiddenError("No tienes permisos para acceder a esta ruta")
    return await repo.get_all()
