from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field

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


class ManualEmailKind(str, Enum):
    """Plantillas que el developer puede disparar a mano desde el panel de
    Correos. Usan exactamente el mismo render y envío que los flujos
    automáticos (alta de usuario / barrido de tareas atrasadas).

    `activation` es distinta: además de enviar, MUTA la cuenta — emite un token
    de activación nuevo y deja la contraseña "en blanco" (aleatoria irrecuperable
    + `must_change_password=True`), para notificar a cuentas de producción que se
    crearon antes del flujo por enlace. El único acceso pasa a ser el enlace.
    """

    WELCOME = "welcome"
    OVERDUE = "overdue"
    ACTIVATION = "activation"


class SendManualEmailsRequest(BaseModelConfig):
    kind: ManualEmailKind
    # A quién(es). `welcome` no necesita más contexto; `overdue` busca las
    # tareas vencidas reales de cada persona y manda un correo por tarea.
    recipient_ids: List[UUID] = Field(min_length=1, max_length=100)


class ManualEmailResult(BaseModelConfig):
    user_id: UUID
    email: str
    name: str
    # Correos efectivamente enviados a esta persona (0 si no aplicaba o falló).
    sent: int
    detail: str
    # Solo para `activation`: si la persona ya había entrado (tenía su propia
    # contraseña) antes de invalidársela. None para el resto de plantillas.
    already_entered: Optional[bool] = None


class SendManualEmailsResponse(BaseModelConfig):
    kind: ManualEmailKind
    results: List[ManualEmailResult]
    total_sent: int
