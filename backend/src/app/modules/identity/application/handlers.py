from urllib.parse import quote

from app.shared.email.sender import EmailSender
from app.shared.email.templates import welcome_email
from app.shared.events.events import UserCreated


class NotifyUserCreatedByEmail:
    """Avisa por correo cuando se crea una cuenta nueva (alta individual o CSV).

    El alta no manda ninguna contraseña: el evento trae un `activation_token` de
    un solo uso y el correo lleva el botón "Activar mi cuenta" hacia
    `{public_url}/activar?token=...`, donde la persona define su clave. El camino
    de `temporary_password` se mantiene solo por compatibilidad.
    """

    def __init__(
        self,
        email_sender: EmailSender,
        public_url: str = "",
        activation_expire_days: int = 7,
    ) -> None:
        self._sender = email_sender
        self._public_url = public_url.rstrip("/")
        self._activation_expire_days = activation_expire_days

    async def __call__(self, event: UserCreated) -> None:
        activation_url = (
            f"{self._public_url}/activar?token={quote(event.activation_token)}"
            if event.activation_token and self._public_url
            else None
        )
        mail = welcome_email(
            name=event.name,
            email=event.email,
            login_url=self._public_url or "",
            # JPG y no WebP: Outlook y varios clientes de correo no renderizan
            # WebP. La imagen debe servirse desde una URL pública https.
            logo_url=f"{self._public_url}/logo-email.jpg" if self._public_url else "",
            temporary_password=event.temporary_password,
            activation_url=activation_url,
            activation_expire_days=self._activation_expire_days,
        )
        await self._sender.send(
            to=event.email,
            subject=mail.subject,
            body=mail.text,
            html=mail.html,
        )
