from uuid import UUID

from fastapi import Depends, Path, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token
from app.modules.areas.infrastructure.repository import (
    AreaRepository,
    SqlAlchemyAreaRepository,
)
from app.modules.collaborators.domain.repository import CollaboratorRepository
from app.modules.collaborators.infrastructure.repository import (
    SqlAlchemyCollaboratorRepository,
)
from app.modules.dashboard.infrastructure.repository import (
    DashboardRepository,
    SqlAlchemyDashboardRepository,
)
from app.modules.feedback.domain.repository import FeedbackRepository
from app.modules.feedback.infrastructure.repository import (
    SqlAlchemyFeedbackRepository,
)
from app.modules.identity.application.handlers import NotifyUserCreatedByEmail
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.infrastructure.repository import (
    PositionRepository,
    UserRepository,
)
from app.modules.identity.presentation.schemas import UserResponse
from app.modules.notifications.application.registry import (
    register_notification_handlers,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.repository import (
    SqlAlchemyNotificationRepository,
)
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.repository import (
    ProjectMemberRepository,
    ProjectRepository,
)
from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.repository import (
    SqlAlchemyWorkTreeRepository,
)
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.domain.workspace import WorkspaceRepository
from app.modules.teams.infrastructure.repository import SqlAlchemyTeamRepository
from app.modules.teams.infrastructure.workspace_repository import (
    SqlAlchemyWorkspaceRepository,
)
from app.modules.traceability.infrastructure.repository import (
    SqlAlchemyTraceabilityRepository,
    TraceabilityRepository,
)
from app.shared.authz import role_satisfies
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.email.sender import SmtpEmailSender
from app.shared.events import EventBus
from app.shared.events.events import UserCreated
from app.shared.exceptions import ForbiddenError, NotFoundError


def project_repo_dependency(db: AsyncSession = Depends(get_db)) -> ProjectRepository:
    return ProjectRepository(db)


def user_repo_dependency(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def position_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> PositionRepository:
    return PositionRepository(db)


def project_members_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberRepository:
    return ProjectMemberRepository(db)


def team_repo_dependency(db: AsyncSession = Depends(get_db)) -> TeamRepository:
    # Devuelve la abstracción; la implementación concreta es intercambiable (DIP).
    return SqlAlchemyTeamRepository(db)


def workspace_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> WorkspaceRepository:
    return SqlAlchemyWorkspaceRepository(db)


def worktree_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> WorkTreeRepository:
    return SqlAlchemyWorkTreeRepository(db)


def task_repo_dependency(db: AsyncSession = Depends(get_db)) -> TaskRepository:
    return TaskRepository(db)


def dashboard_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> DashboardRepository:
    return SqlAlchemyDashboardRepository(db)


def collaborator_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> CollaboratorRepository:
    return SqlAlchemyCollaboratorRepository(db)


def traceability_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> TraceabilityRepository:
    return SqlAlchemyTraceabilityRepository(db)


def area_repo_dependency(db: AsyncSession = Depends(get_db)) -> AreaRepository:
    return SqlAlchemyAreaRepository(db)


def notification_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> NotificationRepository:
    return SqlAlchemyNotificationRepository(db)


def feedback_repo_dependency(
    db: AsyncSession = Depends(get_db),
) -> FeedbackRepository:
    return SqlAlchemyFeedbackRepository(db)


def get_broadcaster_from_request(request: Request) -> Broadcaster:
    return request.app.state.broadcaster


def event_bus_dependency(
    db: AsyncSession = Depends(get_db),
    broadcaster: Broadcaster = Depends(get_broadcaster_from_request),
) -> EventBus:
    """Construye un EventBus por-request con sus handlers ya suscritos.

    Cada handler se crea con repos que comparten la misma `AsyncSession` del
    request, así toda la transacción (cambio de dominio + notificación) viaja
    en el mismo commit. Trade-off: el bus no es singleton — se rearma por
    request — pero el costo es despreciable y la consistencia transaccional
    sale gratis.
    """
    bus = EventBus()
    notification_repo = SqlAlchemyNotificationRepository(db)
    register_notification_handlers(bus, notification_repo, broadcaster, db)
    bus.subscribe(
        UserCreated, NotifyUserCreatedByEmail(SmtpEmailSender(get_settings()))
    )
    return bus


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    try:
        payload = decode_token(token)
    except JWTError:
        raise ForbiddenError("Token inválido o expirado")

    if payload.get("type") != "access":
        raise ForbiddenError("Token inválido")

    user_id = UUID(payload["sub"])

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)

    if not user or not user.is_active:
        raise NotFoundError("Usuario no encontrado")

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        last_name=user.last_name,
        role=user.role,
        position=user.position,
        is_active=user.is_active,
    )


def require_role(*roles: str):
    async def _check(current_user=Depends(get_current_user)):
        if not role_satisfies(current_user.role, roles):
            raise ForbiddenError("No tienes permiso para acceder a este recurso")
        return current_user

    return _check


def require_project_permission(*allowed_project_roles: ProjectRole):
    """
    Permite el acceso si el usuario tiene un SystemRole de acceso total (ADMIN/SUPER_ADMIN)
    O si posee un ProjectRole autorizado dentro del proyecto específico.
    """

    async def _auth_check(
        project_id: UUID = Path(
            ...
        ),  # Captura automáticamente el work_item_id de la URL
        current_user: UserResponse = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        # Regla 1: acceso total global (Developer/Super Admin/Admin) pasa directo.
        if role_satisfies(
            current_user.role, [SystemRole.SUPER_ADMIN, SystemRole.ADMIN]
        ):
            return current_user

        # Regla 2: Si es usuario estándar, verificamos su rol contextual en este proyecto
        member_repo = ProjectMemberRepository(db)
        # Buscamos la fila en la tabla intermedia project_members
        member = await member_repo.get_member_by_project_id_and_user_id(
            project_id=project_id, user_id=current_user.id
        )

        if not member or member.is_deleted:
            raise ForbiddenError("No formas parte de este proyecto")

        if member.project_role not in allowed_project_roles:
            raise ForbiddenError(
                "No tienes el rol requerido dentro de este proyecto para realizar esta acción"
            )

        return current_user

    return _auth_check
