"""Puente entre la entrega/aprobación de un entregable (módulo de equipos) y la
cascada de fechas del módulo de tareas.

Entregar (tarea sin revisión) o aprobar un entregable deja la tarea en
COMPLETADA por una vía que NO pasa por `ChangeTaskStatusUseCase`, así que la
cascada finish-to-start («la fecha fin de la dependencia pasa a ser el inicio de
la que depende») no se dispara sola. Este helper la lanza a mano con el mismo
ancla que usaría el cambio de estado manual.
"""

from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus


async def cascade_after_completion(session, bus, task, actor_id: UUID | None) -> None:
    """Reprograma en cadena las tareas que dependen de `task` si acaba de quedar
    COMPLETADA. No-op si `task` es None o no está completada."""
    if session is None or task is None or task.status != TaskStatus.COMPLETADA:
        return

    # Import diferido: evita el ciclo tasks.application <-> teams.application.
    from app.modules.tasks.application.use_cases import cascade_reschedule_dependents
    from app.modules.tasks.infrastructure.repository import TaskRepository

    completed_at = getattr(task, "completed_at", None)
    anchor = task.due_date or (completed_at.date() if completed_at else None)
    await cascade_reschedule_dependents(
        TaskRepository(session),
        bus,
        source_id=task.id,
        source_title=task.title,
        project_id=task.project_id,
        anchor=anchor,
        actor_id=actor_id,
    )
