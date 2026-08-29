from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    notification_repo_dependency,
    require_role,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.presentation.schemas import UserResponse
from app.modules.notifications.application.overdue_scan import scan_overdue_tasks
from app.modules.notifications.application.use_cases import (
    DeleteNotificationUseCase,
    GetUnreadCountUseCase,
    ListMyNotificationsUseCase,
    MarkAllAsReadUseCase,
    MarkNotificationAsReadUseCase,
)
from app.shared.email.sender import SmtpEmailSender
from app.modules.notifications.presentation.schemas import (
    MarkAllReadResponse,
    NotificationResponse,
    PaginatedNotificationsResponse,
    UnreadCountResponse,
)
from app.shared.pagination import Pagination, pagination_params

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=PaginatedNotificationsResponse)
async def list_my_notifications(
    only_unread: bool = False,
    pagination: Pagination = Depends(pagination_params),
    repo=Depends(notification_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await ListMyNotificationsUseCase(repo).execute(
        user_id=current_user.id,
        only_unread=only_unread,
        pagination=pagination,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    repo=Depends(notification_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await GetUnreadCountUseCase(repo).execute(current_user.id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: UUID,
    repo=Depends(notification_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await MarkNotificationAsReadUseCase(repo).execute(
        notification_id=notification_id,
        requester_id=current_user.id,
    )


@router.patch("/read-all", response_model=MarkAllReadResponse)
async def mark_all_as_read(
    repo=Depends(notification_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    return await MarkAllAsReadUseCase(repo).execute(current_user.id)


@router.post("/overdue-scan")
async def run_overdue_scan(
    db: AsyncSession = Depends(get_db),
    _admin: UserResponse = Depends(
        require_role(SystemRole.ADMIN, SystemRole.SUPER_ADMIN, SystemRole.DEVELOPER)
    ),
):
    """Dispara el barrido de tareas atrasadas de inmediato (además del bucle
    periódico). Útil para pruebas y para forzar los avisos tras un import."""
    settings = get_settings()
    result = await scan_overdue_tasks(
        db,
        email_sender=SmtpEmailSender(settings),
        public_url=settings.APP_PUBLIC_URL,
    )
    return {
        "checked": result.checked,
        "notified": result.notified,
        "skipped_cooldown": result.skipped_cooldown,
        "emails_sent": result.emails_sent,
    }


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    repo=Depends(notification_repo_dependency),
    current_user: UserResponse = Depends(get_current_user),
):
    await DeleteNotificationUseCase(repo).execute(
        notification_id=notification_id,
        requester_id=current_user.id,
    )
