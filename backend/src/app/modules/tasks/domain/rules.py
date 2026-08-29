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


def incomplete_dependency_ids(dependencies) -> list[UUID]:
    """Ids de las tareas-prerrequisito que aún no están completadas (aprobadas).

    Regla de negocio: una tarea que depende de otra no puede avanzar de estado
    mientras esa otra no esté COMPLETADA.
    """
    blocking: list[UUID] = []
    for dep in dependencies:
        target = getattr(dep, "depends_on", None)
        if target is None or target.status != TaskStatus.COMPLETADA:
            blocking.append(dep.depends_on_id)
    return blocking


def earlier_phase_blocks(tasks_in_earlier_phases) -> bool:
    """True si alguna tarea de una fase anterior sigue sin cerrarse."""
    return any(t.status not in _TERMINAL for t in tasks_in_earlier_phases)


def is_self_dependency(task_id: UUID, depends_on_id: UUID) -> bool:
    return task_id == depends_on_id
