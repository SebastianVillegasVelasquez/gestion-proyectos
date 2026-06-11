from enum import Enum


class TaskStatus(str, Enum):
    PENDIENTE_POR_INICIAR = "pendiente_por_iniciar"
    EN_PROGRESO = "en_progreso"
    EN_REVISION = "en_revision"  # Cuando el integrante termina y espera aprobación
    DEVUELTA = "devuelta"  # Cuando el revisor rechaza el trabajo
    COMPLETADA = "completada"  # Aprobación final
    CANCELADA = "cancelada"


class TaskPriority(str, Enum):
    NO_DEFINIDA = "no_definida"
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class HistoryAction(str, Enum):
    CREACION = "creacion"
    CAMBIO_ESTADO = "cambio_estado"
    REASIGNACION = "reasignacion"
    COMENTARIO = "comentario"
