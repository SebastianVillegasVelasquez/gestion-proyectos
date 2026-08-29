"""NotifyUserCreatedByEmail: el evento UserCreated dispara un intento de envío
de correo (hoy un puerto "listo" pero sin credenciales SMTP reales).
"""

import datetime
import uuid

from app.modules.identity.application.handlers import NotifyUserCreatedByEmail
from app.shared.events.events import UserCreated


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(
        self, *, to: str, subject: str, body: str, html: str | None = None
    ) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body, "html": html})


class TestNotifyUserCreatedByEmail:
    async def test_sends_welcome_email_on_user_created(self):
        sender = FakeEmailSender()
        handler = NotifyUserCreatedByEmail(sender)

        await handler(
            UserCreated(
                occurred_at=datetime.datetime.now(datetime.timezone.utc),
                user_id=uuid.uuid4(),
                email="nuevo@example.com",
                name="Ana",
            )
        )

        assert len(sender.sent) == 1
        assert sender.sent[0]["to"] == "nuevo@example.com"
        assert "Ana" in sender.sent[0]["body"]
        # No debe filtrar contraseñas: el evento ni siquiera las lleva.
        assert "password" not in sender.sent[0]["body"].lower()


class TestSmtpEmailSenderWithoutCredentials:
    async def test_logs_and_skips_when_smtp_not_configured(self):
        from app.core.config import Settings
        from app.shared.email.sender import SmtpEmailSender

        settings = Settings(SMTP_USER="", SMTP_PASSWORD="")
        sender = SmtpEmailSender(settings)

        # No debe lanzar ni intentar conectarse a un servidor SMTP real.
        await sender.send(to="x@example.com", subject="Hola", body="Cuerpo")
