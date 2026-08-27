"""Escritura del historial de una tarea (trazabilidad).

Auditar y notificar son dos cosas distintas, y confundirlas fue el origen del
bug que este módulo corrige: los manejadores de notificaciones guardaban en
`TaskHistory` el id del RESPONSABLE de la tarea como si fuera quien hizo el
cambio. Resultado: el historial decía que Ana creó una tarea que en realidad le
creó su coordinador, y las tareas sin responsable quedaban con un actor nulo
("Alguien" en pantalla).

Aquí el actor es siempre quien ejecuta la acción, y se registra TODO cambio
relevante, tenga o no a quién avisar.

Los valores del delta se guardan ya resueltos a texto legible: el historial es
un hecho del pasado y debe seguir leyéndose aunque después se renombre el
equipo o se borre el elemento de la estructura.
"""

from datetime import date
from uuid import UUID

from app.modules.tasks.infrastructure.enums import (
    HistoryAction,
    TaskPriority,
    TaskStatus,
)
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.tasks.infrastructure.repository import TaskRepository

_PRIORITY_LABELS = {
    TaskPriority.NO_DEFINIDA: "Sin definir",
    TaskPriority.BAJA: "Baja",
    TaskPriority.MEDIA: "Media",
    TaskPriority.ALTA: "Alta",
    TaskPriority.URGENTE: "Urgente",
}


def _fmt_priority(value: TaskPriority | None) -> str:
    return _PRIORITY_LABELS.get(value, "Sin definir") if value else "Sin definir"


def _fmt_date(value: date | None) -> str:
    return value.isoformat() if value else "sin fecha"


def _fmt_range(start: date | None, due: date | None) -> str:
    return f"{_fmt_date(start)} → {_fmt_date(due)}"


class TaskAuditor:
    """Registra en `task_history` lo que le pasa a una tarea.

    Recibe el actor una sola vez (quien está autenticado en la petición) para
    que ningún punto de llamada pueda olvidarlo o pasar el id equivocado.

    `actor_id` puede ser `None` en procesos sin usuario (semillas, tareas
    programadas): el evento se registra igual, sin actor, porque perder el
    hecho es peor que no saber quién lo provocó.
    """

    def __init__(self, repo: TaskRepository, actor_id: UUID | None = None) -> None:
        self._repo = repo
        self._actor_id = actor_id

    async def _record(
        self,
        task_id: UUID,
        action: HistoryAction,
        *,
        old_status: TaskStatus | None = None,
        new_status: TaskStatus | None = None,
        old_value: str | None = None,
        new_value: str | None = None,
        reason: str | None = None,
    ) -> None:
        await self._repo.add_history(
            TaskHistory(
                task_id=task_id,
                changed_by_id=self._actor_id,
                action=action,
                old_status=old_status,
                new_status=new_status,
                old_value=old_value,
                new_value=new_value,
                change_reason=reason,
            )
        )

    async def created(
        self, task_id: UUID, title: str, status: TaskStatus | None = None
    ) -> None:
        await self._record(
            task_id, HistoryAction.CREACION, new_status=status, new_value=title
        )

    async def status_changed(
        self,
        task_id: UUID,
        old_status: TaskStatus | None,
        new_status: TaskStatus,
        reason: str | None = None,
    ) -> None:
        if old_status == new_status:
            return
        await self._record(
            task_id,
            HistoryAction.CAMBIO_ESTADO,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
        )

    async def diff(self, before: dict, task: Task) -> None:
        """Compara el estado previo de la tarea con el actual y registra un
        evento por cada campo que cambió de verdad.

        Un `PATCH` puede tocar cinco campos a la vez; el historial guarda cinco
        hechos separados y no uno agregado, porque cada uno se lee, se filtra y
        se explica por su cuenta ("cambió de equipo" no es "se le movió la
        fecha").
        """
        if before.get("assignee_id") != task.assignee_id:
            await self._record(
                task.id,
                HistoryAction.REASIGNACION,
                old_value=await self._user_label(before.get("assignee_id")),
                new_value=await self._user_label(task.assignee_id),
            )

        if before.get("team_id") != task.team_id:
            await self._record(
                task.id,
                HistoryAction.CAMBIO_EQUIPO,
                old_value=await self._team_label(before.get("team_id")),
                new_value=await self._team_label(task.team_id),
            )

        if before.get("work_item_id") != task.work_item_id:
            await self._record(
                task.id,
                HistoryAction.CAMBIO_UBICACION,
                old_value=await self._work_item_label(before.get("work_item_id")),
                new_value=await self._work_item_label(task.work_item_id),
            )

        if (
            before.get("start_date") != task.start_date
            or before.get("due_date") != task.due_date
        ):
            await self._record(
                task.id,
                HistoryAction.CAMBIO_FECHAS,
                old_value=_fmt_range(before.get("start_date"), before.get("due_date")),
                new_value=_fmt_range(task.start_date, task.due_date),
            )

        if before.get("priority") != task.priority:
            await self._record(
                task.id,
                HistoryAction.CAMBIO_PRIORIDAD,
                old_value=_fmt_priority(before.get("priority")),
                new_value=_fmt_priority(task.priority),
            )

    async def location_changed(self, task: Task, old_work_item_id: UUID | None) -> None:
        if old_work_item_id == task.work_item_id:
            return
        await self._record(
            task.id,
            HistoryAction.CAMBIO_UBICACION,
            old_value=await self._work_item_label(old_work_item_id),
            new_value=await self._work_item_label(task.work_item_id),
        )

    # ── Resolución de etiquetas ───────────────────────────────────────────────
    async def _user_label(self, user_id: UUID | None) -> str:
        return await self._repo.user_label(user_id) if user_id else "Sin responsable"

    async def _team_label(self, team_id: UUID | None) -> str:
        return await self._repo.team_label(team_id) if team_id else "Sin equipo"

    async def _work_item_label(self, work_item_id: UUID | None) -> str:
        return (
            await self._repo.work_item_label(work_item_id)
            if work_item_id
            else "Sin ubicación"
        )


def snapshot(task: Task) -> dict:
    """Copia de los campos auditables ANTES de aplicar un cambio.

    Un dict plano y no la instancia del ORM: `task` es el mismo objeto que se va
    a mutar, así que guardar una referencia daría siempre el valor nuevo en
    ambos lados de la comparación.
    """
    return {
        "assignee_id": task.assignee_id,
        "team_id": task.team_id,
        "work_item_id": task.work_item_id,
        "start_date": task.start_date,
        "due_date": task.due_date,
        "priority": task.priority,
        "status": task.status,
    }
