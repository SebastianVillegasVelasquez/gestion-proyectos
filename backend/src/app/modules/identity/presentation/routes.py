from uuid import UUID

from fastapi import Depends
from fastapi.routing import APIRouter

from app.core.dependencies import (
    get_current_user,
    user_repo_dependency,
    require_role,
)
from app.modules.identity.application.use_cases import (
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserByIdUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    SearchUsersUseCase,
    UpdateUserUseCase,
)
from app.shared.pagination import Pagination, pagination_params
from app.modules.identity.infrastructure.repository import UserRepository
from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    DirectoryUserResponse,
    LoginRequest,
    PaginatedDirectoryResponse,
    PositionOption,
    RefreshRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
    position_options,
)

router = APIRouter(prefix="/identity", tags=["Identity"])


@router.post("/", response_model=UserResponse, status_code=201)
async def create(
    data: CreateUserRequest,
    repo: UserRepository = Depends(user_repo_dependency),
):
    return await CreateUserUseCase(user_repo=repo).execute(data)


@router.get("/positions", response_model=list[PositionOption])
async def positions():
    """Cargos disponibles para poblar el selector del registro.

    Público (la pantalla de registro no está autenticada). Es la única fuente de
    verdad de los cargos: si más adelante se migran a una tabla, este contrato
    (value/label) no cambia y el frontend no se toca.
    """
    return position_options()


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    repo: UserRepository = Depends(user_repo_dependency),
):
    return await LoginUseCase(repo).execute(data.email, data.password)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    repo: UserRepository = Depends(user_repo_dependency),
):
    return await RefreshTokenUseCase(repo).execute(data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.get("/directory", response_model=list[DirectoryUserResponse])
async def directory(
    position: UserPosition | None = None,
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Lista de usuarios activos para asignar tareas, filtrable por cargo."""
    users = await repo.get_all()
    return [
        u
        for u in users
        if u.is_active
        and not u.is_deleted
        and (position is None or u.position == position)
    ]


@router.get("/users", response_model=list[UserResponse])
async def get_users(
    repo: UserRepository = Depends(user_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    return await repo.get_all()


@router.get("/users/search", response_model=PaginatedDirectoryResponse)
async def search_users(
    search: str | None = None,
    position: UserPosition | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Búsqueda paginada de usuarios (nombre/correo/cargo) para los selectores."""
    return await SearchUsersUseCase(repo).execute(search, position, pagination)


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def get_user_by_id(
    user_id: UUID,
    repo: UserRepository = Depends(user_repo_dependency),
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
    repo: UserRepository = Depends(user_repo_dependency),
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
    repo: UserRepository = Depends(user_repo_dependency),
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
    repo: UserRepository = Depends(user_repo_dependency),
    current_user=Depends(
        require_role(
            "admin",
            "super_admin",
        )
    ),
):
    await DeleteUserUseCase(repo).execute(user_id)
