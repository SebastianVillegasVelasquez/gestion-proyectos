"""Herramientas internas para el rol técnico (developer).

Hoy: un endpoint para probar el envío de correo en PRODUCCIÓN sin tener que
disparar un flujo real (alta de usuario, entrega, etc.).
"""

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.logger import get_logger
from app.modules.dev_tools.presentation.schemas import (
    SendTestEmailRequest,
    SendTestEmailResponse,
)
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.presentation.schemas import UserResponse
from app.shared.email.sender import build_email_sender
from app.shared.email.templates import welcome_email
from app.shared.exceptions import ForbiddenError
from app.shared.rate_limit import enforce_rate_limit

logger = get_logger(__name__)

router = APIRouter(prefix="/dev", tags=["Dev tools"])

# `require_role("developer")` ya es estricto (solo DEVELOPER lo satisface), pero
# el envío usa nuestro dominio verificado: se revalida el rol dentro del handler.
_developer = require_role("developer")

# Máximo de correos de prueba por usuario y por minuto.
_TEST_EMAIL_MAX_PER_MINUTE = 5


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

    if data.html_body:
        # Modo avanzado: HTML crudo tal cual lo escribió el developer.
        subject = data.subject or "Correo de prueba — Bitácora"
        html_body = data.html_body
        text_body = "Correo de prueba enviado desde Bitácora."
    else:
        # Por defecto: la plantilla REAL de bienvenida (con logo, botón y
        # pie de marca) — así la prueba valida exactamente lo que recibe
        # cualquier usuario, imágenes incluidas, y no un <p> suelto sin marca.
        public_url = settings.APP_PUBLIC_URL
        rendered = welcome_email(
            name="Prueba",
            email=str(data.to),
            login_url=f"{public_url}/login" if public_url else "",
            logo_url=f"{public_url}/logo-email.jpg" if public_url else "",
        )
        subject = data.subject or rendered.subject
        html_body = rendered.html
        text_body = rendered.text

    logger.info(
        "Correo de prueba solicitado",
        triggered_by=str(current_user.id),
        triggered_by_email=current_user.email,
        to=str(data.to),
        provider=getattr(sender, "provider_name", "unknown"),
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
    )
