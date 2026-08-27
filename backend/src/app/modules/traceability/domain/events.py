import datetime
from dataclasses import dataclass

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus

# Tipos de evento que entiende la línea de tiempo. El color lo decide la capa de
# presentación (frontend); aquí solo damos el significado.
EVENT_CREACION = "creacion"
EVENT_ASIGNACION = "asignacion"
EVENT_INICIO = "inicio"
EVENT_ENTREGA = "entrega"  # enviada a revisión
EVENT_APROBACION = "aprobacion"  # entrega final aceptada
EVENT_DEVOLUCION = "devolucion"  # rechazo / retrabajo
EVENT_CANCELACION = "cancelacion"
EVENT_COMENTARIO = "comentario"
EVENT_CAMBIO_ESTADO = "cambio_estado"  # cambio genérico sin un significado especial
# Cambios de gestión: no mueven el estado de la tarea pero explican su historia
# (por qué acabó en otro equipo, en otro sitio del árbol o con otra fecha).
EVENT_EQUIPO = "equipo"
EVENT_UBICACION = "ubicacion"
EVENT_REPROGRAMACION = "reprogramacion"
EVENT_PRIORIDAD = "prioridad"

# Estados que "cierran" la tarea: un evento posterior a la fecha límite con uno
# de estos NO cuenta como retraso (ya está resuelta).
_TERMINAL = {TaskStatus.COMPLETADA, TaskStatus.CANCELADA}

_MANAGEMENT_KINDS = {
    HistoryAction.CAMBIO_EQUIPO: EVENT_EQUIPO,
    HistoryAction.CAMBIO_UBICACION: EVENT_UBICACION,
    HistoryAction.CAMBIO_FECHAS: EVENT_REPROGRAMACION,
    HistoryAction.CAMBIO_PRIORIDAD: EVENT_PRIORIDAD,
}

_STATUS_TO_KIND = {
    TaskStatus.EN_PROGRESO: EVENT_INICIO,
    TaskStatus.EN_REVISION: EVENT_ENTREGA,
    TaskStatus.COMPLETADA: EVENT_APROBACION,
    TaskStatus.DEVUELTA: EVENT_DEVOLUCION,
    TaskStatus.CANCELADA: EVENT_CANCELACION,
}


@dataclass(frozen=True)
class EventClassification:
    kind: str
    is_delay: bool


def classify_event(
    action: HistoryAction,
    new_status: TaskStatus | None,
    due_date: datetime.date | None,
    occurred_on: datetime.datetime | None,
) -> EventClassification:
    """Devuelve el tipo de evento y si representa un retraso.

    Un evento es "retraso" cuando un cambio de estado ocurre después de la fecha
    límite de la tarea y la tarea aún no está cerrada (sigue pendiente de avanzar
    pese a haber vencido el plazo).
    """
    if action == HistoryAction.CREACION:
        kind = EVENT_CREACION
    elif action == HistoryAction.REASIGNACION:
        kind = EVENT_ASIGNACION
    elif action == HistoryAction.COMENTARIO:
        kind = EVENT_COMENTARIO
    elif action in _MANAGEMENT_KINDS:
        kind = _MANAGEMENT_KINDS[action]
    elif action == HistoryAction.CAMBIO_ESTADO:
        kind = (
            _STATUS_TO_KIND.get(new_status, EVENT_CAMBIO_ESTADO)
            if new_status is not None
            else EVENT_CAMBIO_ESTADO
        )
    else:
        kind = EVENT_CAMBIO_ESTADO

    is_delay = _is_delay(action, new_status, due_date, occurred_on)
    return EventClassification(kind=kind, is_delay=is_delay)


def _is_delay(
    action: HistoryAction,
    new_status: TaskStatus | None,
    due_date: datetime.date | None,
    occurred_on: datetime.datetime | None,
) -> bool:
    if action != HistoryAction.CAMBIO_ESTADO:
        return False
    if due_date is None or occurred_on is None:
        return False
    if new_status in _TERMINAL or new_status is None:
        return False
    return occurred_on.date() > due_date
