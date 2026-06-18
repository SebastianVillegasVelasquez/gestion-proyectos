"""Registro de suscripciones del módulo de notificaciones al EventBus.

Lo expone como una función para que el wiring lo invoque al construir el bus
por-request, pasando los repositorios concretos del request.
"""

from app.modules.notifications.application.handlers import NotifyOnMemberAssigned
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.project.domain.events import MemberAssigned
from app.shared.events import EventBus


def register_notification_handlers(
    bus: EventBus,
    notification_repo: NotificationRepository,
) -> None:
    bus.subscribe(MemberAssigned, NotifyOnMemberAssigned(notification_repo))
