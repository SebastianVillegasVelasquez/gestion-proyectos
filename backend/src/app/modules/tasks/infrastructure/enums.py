from sqlalchemy.sql.sqltypes import Enum


class TaskStatus(str, Enum):
    PENDIENTE = "pendiente"
    EN_PROGRESO = "en_progreso"
    EN_REVISION = "en_revision"  # Cuando el integrante termina y espera aprobación
    DEVUELTA = "devuelta"  # Cuando el revisor rechaza el trabajo
    COMPLETADA = "completada"  # Aprobación final
    CANCELADA = "cancelada"


class TaskPriority(str, Enum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class HistoryAction(str, Enum):
    CREACION = "creacion"
    CAMBIO_ESTADO = "cambio_estado"
    REASIGNACION = "reasignacion"
    COMENTARIO = "comentario"
