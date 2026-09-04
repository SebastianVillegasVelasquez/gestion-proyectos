from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus

# Estados que cuentan como "trabajo terminado" para desbloquear dependencias/fases.
_TERMINAL = (TaskStatus.COMPLETADA, TaskStatus.CANCELADA)

# Transiciones que "hacen avanzar" la tarea. Devolver o cancelar no cuentan:
# se permiten aunque la dependencia siga pendiente.
FORWARD_STATUSES = (
    TaskStatus.EN_PROGRESO,
    TaskStatus.EN_REVISION,
    TaskStatus.COMPLETADA,
)


def is_third_party_tipo(tipo) -> bool:
    """El tipo de nodo marca una «actividad de terceros» (dependencia externa):
    por la bandera explícita o por el nombre reservado."""
    if tipo is None:
        return False
    return bool(getattr(tipo, "es_dependencia_externa", False)) or (
        getattr(tipo, "nombre", "").strip().lower() == "actividad de terceros"
    )


def work_item_is_done(work_item) -> bool:
    """Un elemento del árbol cuenta como "entregado" —y por tanto desbloquea a
    quien depende de él— cuando tiene una fecha REAL de fin o de inicio.

    Para una «actividad de terceros» esto significa que alguien pulsó "Marcar
    como entregada": su fecha PLAN es solo lo previsto (y sirve para posicionar
    a sus hijos), no confirma que el tercero ya entregó los recursos."""
    if work_item is None:
        return False
    return (
        getattr(work_item, "fecha_fin_real", None) is not None
        or getattr(work_item, "fecha_inicio_real", None) is not None
    )


def incomplete_dependency_ids(dependencies) -> list[UUID]:
    """Ids de los predecesores que aún no están "hechos": otra tarea que no
    está COMPLETADA, o un elemento del árbol que no está entregado.

    Regla de negocio: una tarea no puede avanzar de estado mientras un
    predecesor suyo siga pendiente.
    """
    blocking: list[UUID] = []
    for dep in dependencies:
        if getattr(dep, "depends_on_work_item_id", None) is not None:
            if not work_item_is_done(getattr(dep, "depends_on_work_item", None)):
                blocking.append(dep.depends_on_work_item_id)
            continue
        target = getattr(dep, "depends_on", None)
        if target is None or target.status != TaskStatus.COMPLETADA:
            blocking.append(dep.depends_on_id)
    return blocking


# Mensajes de por qué una entrega está bloqueada. Fuente única: los usa tanto
# el 422 del servidor al entregar como la vista "Mis tareas" para deshabilitar
# el botón con el mismo texto.
DELIVERY_BLOCKED_BY_DEPENDENCY = (
    "No puedes entregar: una tarea o actividad de la que depende aún no está "
    "completada."
)
DELIVERY_BLOCKED_BY_THIRD_PARTY = (
    "No puedes entregar: la actividad de terceros de la que depende este "
    "trabajo aún no fue entregada."
)
DELIVERY_BLOCKED_BY_OPEN_SUBTASKS = (
    "No puedes entregar: todavía hay subtareas sin terminar."
)


def has_open_subtasks(subtasks) -> bool:
    """True si alguna subtarea sigue sin cerrarse (ni COMPLETADA ni CANCELADA).

    Una tarea padre ES el entregable (su avance es el promedio del de sus
    subtareas — ver `compute_task_progress`), así que entregarla mientras una
    subtarea sigue abierta dejaría un entregable que no refleja el trabajo
    real. Cancelada SÍ cuenta como "cerrada": ya no representa trabajo
    pendiente.
    """
    return any(s.status not in _TERMINAL for s in subtasks)


def delivery_block_reason(
    dependencies,
    has_undelivered_third_party_ancestor: bool,
    open_subtasks: bool = False,
) -> str | None:
    """Motivo por el que la tarea no se puede entregar todavía, o None si se
    puede. El orden importa: primero las dependencias directas incompletas,
    luego el ancestro «actividad de terceros» sin entregar, y por último las
    subtareas propias sin terminar."""
    if incomplete_dependency_ids(dependencies):
        return DELIVERY_BLOCKED_BY_DEPENDENCY
    if has_undelivered_third_party_ancestor:
        return DELIVERY_BLOCKED_BY_THIRD_PARTY
    if open_subtasks:
        return DELIVERY_BLOCKED_BY_OPEN_SUBTASKS
    return None


def earlier_phase_blocks(tasks_in_earlier_phases) -> bool:
    """True si alguna tarea de una fase anterior sigue sin cerrarse."""
    return any(t.status not in _TERMINAL for t in tasks_in_earlier_phases)


def is_self_dependency(task_id: UUID, depends_on_id: UUID) -> bool:
    return task_id == depends_on_id
