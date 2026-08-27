import enum


class DeliverableStatus(str, enum.Enum):
    """Estado de un entregable dentro del espacio de trabajo del equipo."""

    BORRADOR = "borrador"
    EN_REVISION = "en_revision"
    APROBADO = "aprobado"
    CAMBIOS_SOLICITADOS = "cambios_solicitados"
    # Rechazo ≠ solicitud de cambios: "cambios_solicitados" espera una nueva
    # versión sobre el mismo enfoque; "rechazado" cierra la entrega tal como
    # está (el integrante debe replantearla). Ambos devuelven la Task.
    RECHAZADO = "rechazado"


class ResourceType(str, enum.Enum):
    """Tipo de recurso entregado. `archivo` aún no disponible (nice-to-have)."""

    ENLACE = "enlace"
    REPOSITORIO = "repositorio"
    SCORM = "scorm"
    ARCHIVO = "archivo"


class CommentType(str, enum.Enum):
    """Tipo de aporte en el hilo de retroalimentación."""

    COMENTARIO = "comentario"
    SOLICITUD_CAMBIO = "solicitud_cambio"
    APROBACION = "aprobacion"
    RECHAZO = "rechazo"
