"""Puerto de envío de correo (patrón usado por el resto de handlers del
EventBus: la lógica de negocio depende de una interfaz, no de smtplib).

Hoy la empresa todavía no tiene credenciales de correo corporativo, así que
``SmtpEmailSender`` se degrada a solo registrar en el log cuando SMTP_USER/
SMTP_PASSWORD no están configuradas. En cuanto existan, basta con definirlas
en el .env: el envío real queda "listo" sin tocar código ni el use case que
lo dispara.
"""

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Protocol

from app.core.config import Settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


class SmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def send(self, *, to: str, subject: str, body: str) -> None:
        settings = self._settings
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(
                "SMTP no configurado; se omite el envío de correo",
                to=to,
                subject=subject,
            )
            return

        try:
            await asyncio.to_thread(self._send_sync, to, subject, body)
        except Exception:
            logger.error("Fallo al enviar el correo", to=to, exc_info=True)

    def _send_sync(self, to: str, subject: str, body: str) -> None:
        settings = self._settings
        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
