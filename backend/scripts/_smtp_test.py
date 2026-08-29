"""Prueba manual de envío SMTP real. No forma parte de la app.

Uso:  .venv/Scripts/python.exe scripts/_smtp_test.py destinatario@correo.com
Levanta el mismo SmtpEmailSender y la misma plantilla welcome_email que usa
el alta de usuarios, así el test valida credenciales + render de una sola vez.
"""

import asyncio
import sys

sys.path.insert(0, "src")

from app.core.config import get_settings  # noqa: E402
from app.shared.email.sender import SmtpEmailSender  # noqa: E402
from app.shared.email.templates import welcome_email  # noqa: E402


async def main() -> None:
    to = sys.argv[1] if len(sys.argv) > 1 else "villegasvelasquezs@gmail.com"
    settings = get_settings()
    print(
        f"SMTP_HOST={settings.SMTP_HOST}:{settings.SMTP_PORT} "
        f"user={settings.SMTP_USER} tls={settings.SMTP_TLS}"
    )
    print(f"password set: {bool(settings.SMTP_PASSWORD)} -> enviando a {to}")

    mail = welcome_email(
        name="Sebastián",
        email=to,
        login_url=settings.APP_PUBLIC_URL,
        logo_url=f"{settings.APP_PUBLIC_URL}/logo.webp",
    )
    sender = SmtpEmailSender(settings)
    # Llamamos al envío síncrono directo para que cualquier error SMTP explote
    # aquí (el método público los traga y solo los loguea).
    await asyncio.to_thread(sender._send_sync, to, mail.subject, mail.text, mail.html)
    print("OK: correo entregado al servidor SMTP sin error (revisa la bandeja).")


if __name__ == "__main__":
    asyncio.run(main())
