from uuid import UUID

from fastapi import Depends
from fastapi.routing import APIRouter

from app.core.dependencies import get_current_user, repo_dependency, require_role
from app.modules.identity.application.use_cases import (
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserByIdUseCase,
    LoginUseCase,
    UpdateUserUseCase,
)
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    LoginRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.shared.base_repository import UserRepository

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
    return await repo.get_all()


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def get_user_by_id(
    user_id: UUID,
    repo: UserRepository = Depends(repo_dependency),
    current_user=Depends(
        require_role(
            "admin",
            "super_admin",
            "member",
        )
    ),
):
    return await GetUserByIdUseCase(repo).execute(user_id)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def patch_user(
    user_id: UUID,
    data: UpdateUserRequest,
    repo: UserRepository = Depends(repo_dependency),
    current_user=Depends(
        require_role(
            "admin",
            "super_admin",
        )
    ),
):
    return await UpdateUserUseCase(repo).execute(
        user_id=user_id,
        data=data,
    )


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    repo: UserRepository = Depends(repo_dependency),
    current_user=Depends(
        require_role(
            "admin",
            "super_admin",
        )
    ),
):
    return await UpdateUserUseCase(repo).execute(
        user_id=user_id,
        data=data,
    )


@router.delete("/users/{user_id}", status_code=200)
async def delete_user(
    user_id: UUID,
    repo: UserRepository = Depends(repo_dependency),
    current_user=Depends(
        require_role(
            "admin",
            "super_admin",
        )
    ),
):
    await DeleteUserUseCase(repo).execute(user_id)
