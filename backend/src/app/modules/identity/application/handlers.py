from app.shared.email.sender import EmailSender
from app.shared.events.events import UserCreated


class NotifyUserCreatedByEmail:
    """Avisa por correo cuando se crea una cuenta nueva (alta individual o CSV).

    No incluye la contraseña: quien creó la cuenta ya la tiene (modal de
    credenciales / respuesta de la carga masiva) y se la entrega por un canal
    aparte.
    """

    def __init__(self, email_sender: EmailSender) -> None:
        self._sender = email_sender

    async def __call__(self, event: UserCreated) -> None:
        await self._sender.send(
            to=event.email,
            subject="Bienvenido a Bitácora OBJ",
            body=(
                f"Hola {event.name},\n\n"
                f"Se creó una cuenta para ti en Bitácora OBJ con el correo {event.email}. "
                "Solicita tus credenciales de acceso a quien te dio de alta."
            ),
        )
