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


def work_item_is_done(work_item) -> bool:
    """Un elemento del árbol cuenta como "entregado" para desbloquear una
    dependencia FtS cuando tiene fecha real de fin/inicio, o —si es una
    actividad de terceros (`es_dependencia_externa`)— cuando ya tiene fijada
    su fecha de entrega (fin o inicio plan)."""
    if work_item is None:
        return False
    if (
        getattr(work_item, "fecha_fin_real", None) is not None
        or getattr(work_item, "fecha_inicio_real", None) is not None
    ):
        return True
    tipo = getattr(work_item, "tipo", None)
    if tipo is not None and getattr(tipo, "es_dependencia_externa", False):
        return (
            getattr(work_item, "fecha_fin_plan", None) is not None
            or getattr(work_item, "fecha_inicio_plan", None) is not None
        )
    return False


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


def earlier_phase_blocks(tasks_in_earlier_phases) -> bool:
    """True si alguna tarea de una fase anterior sigue sin cerrarse."""
    return any(t.status not in _TERMINAL for t in tasks_in_earlier_phases)


def is_self_dependency(task_id: UUID, depends_on_id: UUID) -> bool:
    return task_id == depends_on_id
