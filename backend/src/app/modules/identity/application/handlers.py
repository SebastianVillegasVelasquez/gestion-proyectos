from app.shared.email.sender import EmailSender
from app.shared.email.templates import welcome_email
from app.shared.events.events import UserCreated


class NotifyUserCreatedByEmail:
    """Avisa por correo cuando se crea una cuenta nueva (alta individual o CSV).

    No incluye la contraseña: quien creó la cuenta ya la tiene (modal de
    credenciales / respuesta de la carga masiva) y se la entrega por un canal
    aparte.
    """

    def __init__(self, email_sender: EmailSender, public_url: str = "") -> None:
        self._sender = email_sender
        self._public_url = public_url.rstrip("/")

    async def __call__(self, event: UserCreated) -> None:
        mail = welcome_email(
            name=event.name,
            email=event.email,
            login_url=self._public_url or "",
            logo_url=f"{self._public_url}/logo.webp" if self._public_url else "",
        )
        await self._sender.send(
            to=event.email,
            subject=mail.subject,
            body=mail.text,
            html=mail.html,
        )
