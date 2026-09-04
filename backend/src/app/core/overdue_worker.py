"""Bucles en segundo plano de avisos por tiempo.

Dos tareas ``asyncio`` deliberadamente simples (duermen y vuelven a correr):

  * **tareas atrasadas** — cada ``OVERDUE_SCAN_INTERVAL_HOURS`` horas.
  * **recordatorios personales** — cada ``REMINDERS_SCAN_INTERVAL_MINUTES``
    minutos (más fino: un recordatorio a las 9:00 no puede llegar a las 15:00).

No usamos APScheduler ni Celery porque ambos barridos son idempotentes (marcan
lo que ya avisaron) y con una sola réplica del backend un cron interno basta.
Si algún día hay varias réplicas, esto se mueve a un worker aparte o se le
pone un lock en Redis.
"""

from __future__ import annotations

import asyncio

from app.core.config import Settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.shared.email.sender import build_email_sender

logger = get_logger(__name__)


async def _overdue_loop(settings: Settings) -> None:
    interval = max(1, settings.OVERDUE_SCAN_INTERVAL_HOURS) * 3600
    await asyncio.sleep(30)  # deja terminar el arranque (seed, migraciones)
    from app.modules.notifications.application.overdue_scan import (
        scan_due_soon_tasks,
        scan_overdue_tasks,
    )

    while True:
        try:
            async with AsyncSessionLocal() as session:
                email_sender = build_email_sender(settings)
                await scan_overdue_tasks(
                    session,
                    email_sender=email_sender,
                    public_url=settings.APP_PUBLIC_URL,
                )
                await scan_due_soon_tasks(
                    session,
                    email_sender=email_sender,
                    public_url=settings.APP_PUBLIC_URL,
                )
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.error("El barrido de tareas atrasadas falló", exc_info=True)
        await asyncio.sleep(interval)


async def _reminders_loop(settings: Settings) -> None:
    interval = max(1, settings.REMINDERS_SCAN_INTERVAL_MINUTES) * 60
    await asyncio.sleep(20)
    from app.modules.reminders.application.dispatch import dispatch_due_reminders

    while True:
        try:
            async with AsyncSessionLocal() as session:
                await dispatch_due_reminders(
                    session, email_sender=build_email_sender(settings)
                )
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.error("El despacho de recordatorios falló", exc_info=True)
        await asyncio.sleep(interval)


def start_overdue_worker(settings: Settings) -> list[asyncio.Task]:
    """Arranca los bucles habilitados y devuelve sus tasks (para cancelarlas)."""
    tasks: list[asyncio.Task] = []
    if settings.OVERDUE_SCAN_ENABLED:
        logger.info(
            "Barrido de tareas atrasadas activo",
            cada_horas=settings.OVERDUE_SCAN_INTERVAL_HOURS,
        )
        tasks.append(asyncio.create_task(_overdue_loop(settings)))
    else:
        logger.info("Barrido de tareas atrasadas deshabilitado")

    if settings.REMINDERS_SCAN_ENABLED:
        logger.info(
            "Despacho de recordatorios activo",
            cada_minutos=settings.REMINDERS_SCAN_INTERVAL_MINUTES,
        )
        tasks.append(asyncio.create_task(_reminders_loop(settings)))
    else:
        logger.info("Despacho de recordatorios deshabilitado")

    return tasks
