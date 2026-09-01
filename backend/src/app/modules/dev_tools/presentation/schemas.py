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
    # Diagnóstico: qué URLs resolvió el servidor a partir de `APP_PUBLIC_URL`.
    # Si `logo_reachable` es False, el logo NO se verá en los correos aunque el
    # envío funcione — casi siempre `APP_PUBLIC_URL` mal puesto en el `.env` del
    # servidor, o el build del frontend sin `public/logo-email.jpg`.
    resolved_public_url: str = ""
    resolved_login_url: str = ""
    resolved_logo_url: str = ""
    logo_reachable: bool = False
    logo_check_detail: str = ""
