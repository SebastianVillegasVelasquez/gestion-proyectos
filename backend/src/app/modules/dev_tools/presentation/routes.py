"""Herramientas internas para el rol técnico (developer).

Hoy: un endpoint para probar el envío de correo en PRODUCCIÓN sin tener que
disparar un flujo real (alta de usuario, entrega, etc.).
"""

from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.logger import get_logger
from app.modules.dev_tools.presentation.schemas import (
    ManualEmailKind,
    ManualEmailResult,
    SendManualEmailsRequest,
    SendManualEmailsResponse,
    SendTestEmailRequest,
    SendTestEmailResponse,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.infrastructure.models import User
from app.modules.identity.presentation.schemas import UserResponse
from app.modules.notifications.application.overdue_scan import _CLOSED, _task_url
from app.modules.project.infrastructure.models import Project
from app.modules.tasks.infrastructure.models import Task
from app.shared.email.sender import build_email_sender
from app.shared.email.templates import overdue_task_email, welcome_email
from app.shared.exceptions import ForbiddenError
from app.shared.rate_limit import enforce_rate_limit

logger = get_logger(__name__)

router = APIRouter(prefix="/dev", tags=["Dev tools"])

# `require_role("developer")` ya es estricto (solo DEVELOPER lo satisface), pero
# el envío usa nuestro dominio verificado: se revalida el rol dentro del handler.
_developer = require_role("developer")

# Máximo de correos de prueba por usuario y por minuto.
_TEST_EMAIL_MAX_PER_MINUTE = 5


async def _check_logo_reachable(logo_url: str) -> tuple[bool, str]:
    """GET corto al logo que se embebe en los correos. Devuelve
    (alcanzable, detalle) para que el developer confirme de un vistazo si
    `APP_PUBLIC_URL` del servidor apunta a un host público que sirve la imagen.
    """
    if not logo_url:
        return False, "APP_PUBLIC_URL vacío: los correos saldrán sin logo."
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            resp = await client.get(logo_url)
    except httpx.HTTPError as exc:
        return False, f"No se pudo abrir {logo_url}: {exc}"
    ctype = resp.headers.get("content-type", "")
    ok = resp.status_code == 200 and ctype.startswith("image/")
    return ok, f"HTTP {resp.status_code} · content-type: {ctype or '—'}"


@router.post("/email-test", response_model=SendTestEmailResponse)
async def send_test_email(
    data: SendTestEmailRequest,
    current_user: UserResponse = Depends(_developer),
) -> SendTestEmailResponse:
    """Envía un correo de prueba a la dirección indicada. Solo developer.

    - Autenticación + rol `developer` verificados explícitamente.
    - Rate limit: 5 envíos por usuario por minuto.
    - Se registra quién lo disparó y a qué dirección.
    """
    if current_user.role != SystemRole.DEVELOPER:
        raise ForbiddenError("Solo el rol developer puede enviar correos de prueba")

    enforce_rate_limit(
        f"email-test:{current_user.id}",
        max_hits=_TEST_EMAIL_MAX_PER_MINUTE,
        window_seconds=60,
    )

    settings = get_settings()
    sender = build_email_sender(settings)

    # Las mismas URLs que arma producción a partir de `APP_PUBLIC_URL`
    # (sin barra final). Se resuelven siempre para devolverlas en el
    # diagnóstico, use o no la plantilla real.
    public_url = (settings.APP_PUBLIC_URL or "").rstrip("/")
    login_url = f"{public_url}/login" if public_url else ""
    logo_url = f"{public_url}/logo-email.jpg" if public_url else ""

    if data.html_body:
        # Modo avanzado: HTML crudo tal cual lo escribió el developer.
        subject = data.subject or "Correo de prueba — Bitácora"
        html_body = data.html_body
        text_body = "Correo de prueba enviado desde Bitácora."
    else:
        # Por defecto: la plantilla REAL de bienvenida (con logo, botón y
        # pie de marca) — así la prueba valida exactamente lo que recibe
        # cualquier usuario, imágenes incluidas, y no un <p> suelto sin marca.
        rendered = welcome_email(
            name="Prueba",
            email=str(data.to),
            login_url=login_url,
            logo_url=logo_url,
        )
        subject = data.subject or rendered.subject
        html_body = rendered.html
        text_body = rendered.text

    logo_reachable, logo_check_detail = await _check_logo_reachable(logo_url)

    logger.info(
        "Correo de prueba solicitado",
        triggered_by=str(current_user.id),
        triggered_by_email=current_user.email,
        to=str(data.to),
        provider=getattr(sender, "provider_name", "unknown"),
        resolved_public_url=public_url or "—",
        resolved_logo_url=logo_url or "—",
        logo_reachable=logo_reachable,
        logo_check_detail=logo_check_detail,
    )

    try:
        await sender.send(
            to=str(data.to),
            subject=subject,
            body=text_body,
            html=html_body,
            raise_on_error=True,
        )
    except Exception as exc:  # noqa: BLE001 - se registra y se reporta al developer
        logger.error(
            "El correo de prueba falló",
            triggered_by=str(current_user.id),
            to=str(data.to),
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail=f"El proveedor de correo rechazó el envío: {exc}",
        ) from exc

    return SendTestEmailResponse(
        sent=True,
        provider=getattr(sender, "provider_name", "unknown"),
        to=str(data.to),
        resolved_public_url=public_url,
        resolved_login_url=login_url,
        resolved_logo_url=logo_url,
        logo_reachable=logo_reachable,
        logo_check_detail=logo_check_detail,
    )


# Máximo de envíos masivos manuales por developer y por minuto.
_MANUAL_EMAIL_MAX_PER_MINUTE = 3


async def _send_overdue_emails(
    db: AsyncSession, sender, user: User, public_url: str
) -> tuple[int, str]:
    """Manda a `user` un correo por cada tarea suya vencida (mismo criterio y
    plantilla que el barrido automático). Sin anti-spam: es una acción manual."""
    today = date.today()
    rows = (
        await db.execute(
            select(Task, Project.name)
            .join(Project, Task.project_id == Project.id)
            .where(
                Task.assignee_id == user.id,
                Task.deleted_at.is_(None),
                Task.due_date.is_not(None),
                Task.due_date < today,
                Task.status.not_in(_CLOSED),
            )
        )
    ).all()
    if not rows:
        return 0, "Sin tareas vencidas"
    for task, project_name in rows:
        days_overdue = (today - task.due_date).days
        mail = overdue_task_email(
            name=user.name,
            task_title=task.title,
            project_name=project_name,
            due_date=task.due_date,
            days_overdue=days_overdue,
            task_url=_task_url(public_url, task),
        )
        await sender.send(
            to=user.email, subject=mail.subject, body=mail.text, html=mail.html
        )
    plural = "tarea vencida" if len(rows) == 1 else "tareas vencidas"
    return len(rows), f"{len(rows)} {plural}"


@router.post("/emails", response_model=SendManualEmailsResponse)
async def send_manual_emails(
    data: SendManualEmailsRequest,
    current_user: UserResponse = Depends(_developer),
    db: AsyncSession = Depends(get_db),
) -> SendManualEmailsResponse:
    """Dispara a mano una plantilla real a una o varias personas.

    - `welcome`: la misma bienvenida que recibe una cuenta nueva.
    - `overdue`: un correo por cada tarea vencida real del destinatario.

    Solo developer; rate limit de 3 envíos por minuto. Cada envío queda en los
    logs (quién lo disparó, plantilla y total).
    """
    if current_user.role != SystemRole.DEVELOPER:
        raise ForbiddenError("Solo el rol developer puede enviar correos")

    enforce_rate_limit(
        f"manual-emails:{current_user.id}",
        max_hits=_MANUAL_EMAIL_MAX_PER_MINUTE,
        window_seconds=60,
    )

    settings = get_settings()
    sender = build_email_sender(settings)
    public_url = (settings.APP_PUBLIC_URL or "").rstrip("/")
    login_url = f"{public_url}/login" if public_url else ""
    logo_url = f"{public_url}/logo-email.jpg" if public_url else ""

    users = list(
        (
            await db.execute(
                select(User).where(
                    User.id.in_(data.recipient_ids), User.deleted_at.is_(None)
                )
            )
        )
        .scalars()
        .all()
    )

    results: list[ManualEmailResult] = []
    total_sent = 0
    for user in users:
        try:
            if data.kind == ManualEmailKind.WELCOME:
                mail = welcome_email(
                    name=user.name,
                    email=user.email,
                    login_url=login_url,
                    logo_url=logo_url,
                )
                await sender.send(
                    to=user.email,
                    subject=mail.subject,
                    body=mail.text,
                    html=mail.html,
                )
                sent, detail = 1, "Correo de bienvenida enviado"
            else:
                sent, detail = await _send_overdue_emails(db, sender, user, public_url)
        except Exception as exc:  # noqa: BLE001 - un correo caído no aborta el lote
            logger.error(
                "Fallo al enviar correo manual",
                triggered_by=str(current_user.id),
                to=user.email,
                kind=data.kind.value,
                exc_info=True,
            )
            results.append(
                ManualEmailResult(
                    user_id=user.id,
                    email=user.email,
                    name=f"{user.name} {user.last_name}".strip(),
                    sent=0,
                    detail=f"Error: {exc}",
                )
            )
            continue
        total_sent += sent
        results.append(
            ManualEmailResult(
                user_id=user.id,
                email=user.email,
                name=f"{user.name} {user.last_name}".strip(),
                sent=sent,
                detail=detail,
            )
        )

    found = {u.id for u in users}
    for missing in data.recipient_ids:
        if missing not in found:
            results.append(
                ManualEmailResult(
                    user_id=missing,
                    email="—",
                    name="—",
                    sent=0,
                    detail="Usuario no encontrado",
                )
            )

    logger.info(
        "Correos manuales enviados",
        triggered_by=str(current_user.id),
        triggered_by_email=current_user.email,
        kind=data.kind.value,
        recipients=len(data.recipient_ids),
        total_sent=total_sent,
    )
    return SendManualEmailsResponse(
        kind=data.kind, results=results, total_sent=total_sent
    )
