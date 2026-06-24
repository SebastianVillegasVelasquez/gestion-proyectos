from uuid import UUID

from fastapi import Depends
from fastapi.routing import APIRouter

from app.core.dependencies import (
    get_current_user,
    user_repo_dependency,
    require_role,
)
from app.modules.identity.application.use_cases import (
    ChangeMyPasswordUseCase,
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserByIdUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    ResetUserPasswordUseCase,
    SearchUsersUseCase,
    UpdateUserUseCase,
)
from app.shared.pagination import Pagination, pagination_params
from app.shared.rate_limit import rate_limiter
from app.modules.identity.infrastructure.repository import UserRepository
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.presentation.schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    DirectoryUserResponse,
    LoginRequest,
    PaginatedDirectoryResponse,
    PositionOption,
    RefreshRequest,
    ResetPasswordResponse,
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
    """Registro PÚBLICO (sin autenticación).

    Seguridad: forzamos role=USER aunque el cliente envíe otro. Si no, cualquiera
    podría auto-asignarse super_admin. La creación con rol vive en POST /users
    (solo administración).
    """
    data.role = SystemRole.USER
    return await CreateUserUseCase(user_repo=repo).execute(data)


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user_admin(
    data: CreateUserRequest,
    repo: UserRepository = Depends(user_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    """Creación de usuarios por administración: honra el rol indicado."""
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
    _: None = rate_limiter(max_hits=10, window_seconds=60, scope="login"),
):
    # Límite anti fuerza bruta: 10 intentos por IP por minuto.
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


@router.patch("/me/password", status_code=204)
async def change_my_password(
    data: ChangePasswordRequest,
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """El usuario autenticado cambia su propia contraseña (verifica la actual)."""
    await ChangeMyPasswordUseCase(repo).execute(
        current_user.id, data.current_password, data.new_password
    )


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_user_password(
    user_id: UUID,
    repo: UserRepository = Depends(user_repo_dependency),
    current_user=Depends(require_role("admin", "super_admin")),
):
    """Administración genera una contraseña temporal para entregar al usuario."""
    return await ResetUserPasswordUseCase(repo).execute(user_id)


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
