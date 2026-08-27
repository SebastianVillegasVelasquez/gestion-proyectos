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
    """Qué clase de cambio quedó registrado en el historial de una tarea.

    Auditar no es lo mismo que notificar: aquí entra TODO cambio relevante,
    tenga o no a quién avisar. Un coordinador que pregunta "¿por qué esta
    tarea se retrasó?" necesita ver que cambió de equipo el martes y que le
    movieron la fecha el jueves, no solo las entregas.
    """

    CREACION = "creacion"
    CAMBIO_ESTADO = "cambio_estado"
    REASIGNACION = "reasignacion"
    COMENTARIO = "comentario"
    # Añadidos para una trazabilidad profunda: el "qué cambió" concreto va en
    # `old_value` / `new_value` del historial, en texto legible.
    CAMBIO_EQUIPO = "cambio_equipo"
    CAMBIO_UBICACION = "cambio_ubicacion"
    CAMBIO_FECHAS = "cambio_fechas"
    CAMBIO_PRIORIDAD = "cambio_prioridad"
