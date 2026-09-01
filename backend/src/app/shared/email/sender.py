"""Puerto de envío de correo (patrón Adapter).

Toda la lógica de negocio depende de la interfaz ``EmailSender`` — nunca del
SDK de un proveedor concreto — así que cambiar de proveedor no toca ningún use
case ni handler que dispare correos.

Adaptadores disponibles:

- ``ResendEmailSender``  → API de Resend (proveedor de producción).
- ``SmtpEmailSender``    → SMTP directo (legado; solo si ``EMAIL_PROVIDER=smtp``).
- ``LoggingEmailSender`` → no envía, solo registra en el log (local sin claves).

``build_email_sender(settings)`` elige el adaptador según ``EMAIL_PROVIDER`` y
degrada a ``LoggingEmailSender`` si al proveedor elegido le faltan credenciales,
para que el entorno local siga funcionando sin configurar nada.

``send`` acepta ``html`` opcional (multipart texto + HTML) y ``raise_on_error``:
por defecto un fallo de envío se traga y se registra (el correo nunca debe
tumbar el flujo de negocio que lo dispara); con ``raise_on_error=True`` la
excepción se propaga — lo usa el endpoint de prueba, que quiere ver el error.
"""

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Optional, Protocol

from app.core.config import Settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class EmailSender(Protocol):
    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str,
        html: Optional[str] = None,
        raise_on_error: bool = False,
    ) -> None: ...


class _BaseEmailSender:
    """Comparte el manejo de errores: registra y NO propaga, salvo que se pida.

    Las subclases implementan ``_deliver`` (envío real, que puede lanzar).
    """

    provider_name: str = "base"

    async def send(
        self,
        *,
        to: str,
        subject: str,
        body: str,
        html: Optional[str] = None,
        raise_on_error: bool = False,
    ) -> None:
        try:
            await self._deliver(to=to, subject=subject, body=body, html=html)
        except Exception:
            logger.error(
                "Fallo al enviar el correo",
                provider=self.provider_name,
                to=to,
                subject=subject,
                exc_info=True,
            )
            if raise_on_error:
                raise

    async def _deliver(
        self, *, to: str, subject: str, body: str, html: Optional[str]
    ) -> None:  # pragma: no cover - override
        raise NotImplementedError


class LoggingEmailSender(_BaseEmailSender):
    """No envía nada: deja constancia en el log. Es el modo local por defecto
    cuando no hay credenciales del proveedor."""

    provider_name = "log"

    async def _deliver(
        self, *, to: str, subject: str, body: str, html: Optional[str]
    ) -> None:
        logger.info(
            "Correo NO enviado (proveedor 'log'): sin credenciales configuradas",
            to=to,
            subject=subject,
        )


class ResendEmailSender(_BaseEmailSender):
    """Adaptador de Resend (https://resend.com). El SDK es síncrono; se corre en
    un hilo para no bloquear el event loop."""

    provider_name = "resend"

    def __init__(self, settings: Settings) -> None:
        self._api_key = settings.RESEND_API_KEY
        self._from = settings.EMAIL_FROM

    async def _deliver(
        self, *, to: str, subject: str, body: str, html: Optional[str]
    ) -> None:
        await asyncio.to_thread(self._send_sync, to, subject, body, html)

    def _send_sync(self, to: str, subject: str, body: str, html: Optional[str]) -> None:
        import resend

        resend.api_key = self._api_key
        params: dict[str, object] = {
            "from": self._from,
            "to": [to],
            "subject": subject,
            # Resend exige al menos uno de html/text; mandamos ambos si hay HTML.
            "text": body,
        }
        if html:
            params["html"] = html

        # Traza del payload EXACTO que va a la API (sin la api_key, que viaja
        # aparte en resend.api_key). Sirve para diagnosticar de dónde sale el
        # remitente: `from` = settings.EMAIL_FROM; `to` = destinatario del form.
        logger.info(
            "Resend payload",
            resend_from=params["from"],
            resend_to=params["to"],
            resend_subject=params["subject"],
            resend_has_html="html" in params,
            email_from_setting=self._from,
        )

        result = resend.Emails.send(params)  # type: ignore[arg-type]
        logger.info(
            "Correo enviado por Resend",
            to=to,
            subject=subject,
            resend_id=result.get("id") if isinstance(result, dict) else None,
        )


class SmtpEmailSender(_BaseEmailSender):
    """Adaptador SMTP directo (legado). Solo se usa con ``EMAIL_PROVIDER=smtp``."""

    provider_name = "smtp"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def _deliver(
        self, *, to: str, subject: str, body: str, html: Optional[str]
    ) -> None:
        await asyncio.to_thread(self._send_sync, to, subject, body, html)

    def _send_sync(self, to: str, subject: str, body: str, html: Optional[str]) -> None:
        settings = self._settings
        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)


def build_email_sender(settings: Settings) -> EmailSender:
    """Elige el adaptador de correo según la configuración.

    - ``EMAIL_PROVIDER=resend`` (por defecto) → Resend si hay ``RESEND_API_KEY``.
    - ``EMAIL_PROVIDER=smtp``   → SMTP directo si hay ``SMTP_USER``/``SMTP_PASSWORD``.
    - cualquier otro valor, o credenciales ausentes → ``LoggingEmailSender``
      (el envío se degrada a log; nada se rompe en local).
    """
    provider = (settings.EMAIL_PROVIDER or "resend").strip().lower()

    if provider == "resend" and settings.RESEND_API_KEY:
        return ResendEmailSender(settings)

    if provider == "smtp" and settings.SMTP_USER and settings.SMTP_PASSWORD:
        return SmtpEmailSender(settings)

    logger.warning(
        "Correo sin proveedor efectivo; se degrada a solo-log",
        email_provider=provider,
        has_resend_key=bool(settings.RESEND_API_KEY),
        has_smtp=bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
    )
    return LoggingEmailSender()
