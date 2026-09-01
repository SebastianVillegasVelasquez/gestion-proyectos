from typing import Optional

from pydantic import EmailStr

from app.shared.base_model import BaseModelConfig


class SendTestEmailRequest(BaseModelConfig):
    """Envío de un correo de prueba desde el panel del developer.

    Por defecto (sin `subject` ni `html_body`) se envía la plantilla REAL de
    bienvenida (`welcome_email`, con logo y botón): así la prueba valida
    exactamente lo que recibe cualquier usuario, imágenes incluidas.
    `subject` / `html_body` son un modo avanzado para probar HTML crudo.
    """

    to: EmailStr
    subject: Optional[str] = None
    html_body: Optional[str] = None


class SendTestEmailResponse(BaseModelConfig):
    sent: bool
    provider: str
    to: str
