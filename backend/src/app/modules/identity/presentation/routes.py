import csv
import io
from uuid import UUID

from fastapi import Depends, HTTPException, UploadFile
from fastapi.routing import APIRouter

from app.core.dependencies import (
    event_bus_dependency,
    get_current_user,
    position_repo_dependency,
    user_repo_dependency,
    require_role,
)
from app.modules.identity.application.use_cases import (
    BulkCreateUsersUseCase,
    ChangeMyPasswordUseCase,
    CreatePositionUseCase,
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserByIdUseCase,
    ListPositionsUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    ResetUserPasswordUseCase,
    SearchUsersAdminUseCase,
    SearchUsersUseCase,
    UpdateUserUseCase,
)
from app.shared.events import EventBus
from app.shared.pagination import Pagination, pagination_params
from app.shared.rate_limit import rate_limiter
from app.modules.identity.infrastructure.repository import (
    PositionRepository,
    UserRepository,
)
from app.modules.identity.presentation.schemas import (
    BulkCreateUsersResponse,
    ChangePasswordRequest,
    CreatePositionRequest,
    CreateUserRequest,
    DirectoryUserResponse,
    LoginRequest,
    MarkReleasesSeenRequest,
    PaginatedDirectoryResponse,
    PaginatedUsersResponse,
    PositionOption,
    RefreshRequest,
    ResetPasswordResponse,
    SeenReleasesResponse,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)

# Roles con acceso a la administración de usuarios: gestión de cuentas y
# cargos es cosa de admin/super_admin/developer (rol técnico, tope de la
# jerarquía). Ya no existe registro público: toda cuenta nueva la crea alguien
# de estos roles (ver create_user_admin más abajo).
MANAGEMENT_ROLES = ("admin", "super_admin", "developer")

router = APIRouter(prefix="/identity", tags=["Identity"])


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user_admin(
    data: CreateUserRequest,
    repo: UserRepository = Depends(user_repo_dependency),
    position_repo: PositionRepository = Depends(position_repo_dependency),
    event_bus: EventBus = Depends(event_bus_dependency),
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    """Creación de usuarios por administración: honra el rol indicado.

    Única vía para crear cuentas (la plataforma es privada, de uso interno;
    no hay registro público).
    """
    return await CreateUserUseCase(
        user_repo=repo, position_repo=position_repo, event_bus=event_bus
    ).execute(data)


@router.post("/users/bulk", response_model=BulkCreateUsersResponse, status_code=201)
async def create_users_bulk(
    file: UploadFile,
    repo: UserRepository = Depends(user_repo_dependency),
    position_repo: PositionRepository = Depends(position_repo_dependency),
    event_bus: EventBus = Depends(event_bus_dependency),
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    """Carga masiva de usuarios desde un CSV (columnas: email, name, last_name,
    role, position, password). `role`/`position`/`password` son opcionales:
    por defecto `user`, `sin_cargo` y una contraseña temporal generada.

    Procesa cada fila de forma independiente: una fila inválida no bloquea
    al resto del archivo (ver BulkCreateUsersUseCase).
    """
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="El archivo debe ser UTF-8")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=422, detail="El CSV está vacío")

    rows = [row for row in reader]
    return await BulkCreateUsersUseCase(
        user_repo=repo, position_repo=position_repo, event_bus=event_bus
    ).execute(rows)


@router.get("/positions", response_model=list[PositionOption])
async def positions(
    position_repo: PositionRepository = Depends(position_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Cargos activos para poblar los selectores de administración.

    Fuente de verdad: la tabla `positions` (mutable). Un cargo nuevo dado de
    alta con POST /identity/positions aparece aquí de inmediato.
    """
    return await ListPositionsUseCase(position_repo).execute()


@router.post("/positions", response_model=PositionOption, status_code=201)
async def create_position(
    data: CreatePositionRequest,
    position_repo: PositionRepository = Depends(position_repo_dependency),
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    """Da de alta un cargo que la empresa nunca había tenido.

    Queda persistido de inmediato (sin migración ni reinicio): el próximo
    usuario que se cree ya puede usarlo.
    """
    return await CreatePositionUseCase(position_repo).execute(data)


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


@router.get("/me/seen-releases", response_model=SeenReleasesResponse)
async def get_seen_releases(
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Ids de novedades que el usuario ya vio (persistido por persona)."""
    return SeenReleasesResponse(
        release_ids=await repo.get_seen_release_ids(current_user.id)
    )


@router.post("/me/seen-releases", response_model=SeenReleasesResponse)
async def mark_seen_releases(
    data: MarkReleasesSeenRequest,
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Marca novedades como vistas (idempotente) y devuelve el set actualizado."""
    updated = await repo.add_seen_releases(current_user.id, data.release_ids)
    return SeenReleasesResponse(release_ids=updated)


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
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    """Administración genera una contraseña temporal para entregar al usuario."""
    return await ResetUserPasswordUseCase(repo).execute(user_id)


@router.get("/directory", response_model=list[DirectoryUserResponse])
async def directory(
    position: str | None = None,
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
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    return await repo.get_all()


@router.get("/users/search", response_model=PaginatedDirectoryResponse)
async def search_users(
    search: str | None = None,
    position: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo: UserRepository = Depends(user_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    """Búsqueda paginada de usuarios (nombre/correo/cargo) para los selectores."""
    return await SearchUsersUseCase(repo).execute(search, position, pagination)


@router.get("/users/manage", response_model=PaginatedUsersResponse)
async def manage_users(
    search: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    repo: UserRepository = Depends(user_repo_dependency),
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
):
    """Lista paginada de usuarios (con rol e is_active) para la gestión admin."""
    return await SearchUsersAdminUseCase(repo).execute(search, pagination)


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
            "developer",
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
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
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
    current_user=Depends(require_role(*MANAGEMENT_ROLES)),
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
