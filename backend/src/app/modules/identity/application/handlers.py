from app.shared.email.sender import EmailSender
from app.shared.email.templates import welcome_email
from app.shared.events.events import UserCreated


class NotifyUserCreatedByEmail:
    """Avisa por correo cuando se crea una cuenta nueva (alta individual o CSV).

    Cuando el sistema generó la contraseña (el admin no definió ninguna), el
    correo la incluye: es la única forma que tiene la persona de entrar. El
    mensaje le dice que caduca en 24 h para empujarla a cambiarla en el primer
    ingreso (la caducidad real la impone el modal de cambio obligatorio, no una
    fecha en base de datos).
    """

    def __init__(self, email_sender: EmailSender, public_url: str = "") -> None:
        self._sender = email_sender
        self._public_url = public_url.rstrip("/")

    async def __call__(self, event: UserCreated) -> None:
        mail = welcome_email(
            name=event.name,
            email=event.email,
            login_url=self._public_url or "",
            # JPG y no WebP: Outlook y varios clientes de correo no renderizan
            # WebP. La imagen debe servirse desde una URL pública https.
            logo_url=f"{self._public_url}/logo-email.jpg" if self._public_url else "",
            temporary_password=event.temporary_password,
        )
        await self._sender.send(
            to=event.email,
            subject=mail.subject,
            body=mail.text,
            html=mail.html,
        )
