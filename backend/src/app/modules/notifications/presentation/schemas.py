from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from app.modules.notifications.infrastructure.enums import NotificationType
from app.shared.base_model import BaseModelConfig


class NotificationResponse(BaseModelConfig):
    id: UUID
    message: str
    user_to_id: UUID
    actor_id: Optional[UUID] = None
    notification_type: NotificationType
    payload: Optional[dict[str, Any]] = None
    read_at: Optional[datetime] = None
    is_read: bool
    created_at: datetime


class PaginatedNotificationsResponse(BaseModelConfig):
    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModelConfig):
    unread_count: int


class MarkAllReadResponse(BaseModelConfig):
    updated: int
