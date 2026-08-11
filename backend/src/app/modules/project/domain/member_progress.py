"""Avance ponderado por integrante: determina cuándo corresponde pagarle.

A un integrante se le asignan tareas, pero esas tareas cuelgan de nodos de la
estructura del proyecto (árbol de WorkItems: p. ej. Curso → Módulo → 3
Unidades por módulo) a distinta profundidad. No todas pesan igual: una tarea
colgada directamente de la raíz representa una porción más grande del proyecto
que una tarea en un nodo profundo de una rama ancha, porque esa rama reparte
su propio peso entre más unidades de trabajo.

Regla de reparto (de arriba hacia abajo): el peso de un nodo (1.0 en la raíz
del proyecto) se divide en partes iguales entre sus tareas propias y sus hijos
CON trabajo (con al menos una tarea en su subárbol); cada hijo repite la
regla con la porción que recibió. Así, cada tarea del proyecto termina con una
fracción de 1.0, y la suma de todas las fracciones es exactamente 1.0.

Ejemplo: un Curso con 2 Módulos, cada Módulo con 3 Unidades y una tarea por
Unidad. El Curso reparte su 1.0 entre sus 2 Módulos (con trabajo) → 0.5 cada
uno. Cada Módulo reparte su 0.5 entre sus 3 Unidades → ~0.167 cada una. Cada
tarea de Unidad pesa ~0.167 del proyecto completo — mucho menos que si hubiera
colgado directamente del Curso.

Las tareas sin nodo (`work_item_id` nulo, "sueltas") se tratan como hijas
directas de la raíz del proyecto, en pie de igualdad con los nodos de primer
nivel. Las tareas delegadas a un equipo (sin responsable individual) reparten
su fracción en partes iguales entre los integrantes del equipo.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable
from uuid import UUID


@dataclass(frozen=True)
class WorkNode:
    id: UUID
    parent_id: UUID | None


@dataclass(frozen=True)
class WorkTask:
    id: UUID
    work_item_id: UUID | None
    assignee_id: UUID | None
    team_id: UUID | None
    is_completed: bool


@dataclass
class MemberProgress:
    tasks_total: int
    tasks_completed: int
    progress_pct: int


def compute_task_weights(
    nodes: Iterable[WorkNode], tasks: Iterable[WorkTask]
) -> dict[UUID, float]:
    """Fracción de 1.0 que representa cada tarea, según su profundidad en el árbol."""
    nodes = list(nodes)
    tasks = list(tasks)

    children: dict[UUID | None, list[UUID]] = {}
    for node in nodes:
        children.setdefault(node.parent_id, []).append(node.id)

    tasks_by_item: dict[UUID | None, list[UUID]] = {}
    for task in tasks:
        tasks_by_item.setdefault(task.work_item_id, []).append(task.id)

    has_work_cache: dict[UUID, bool] = {}

    def has_work(node_id: UUID) -> bool:
        cached = has_work_cache.get(node_id)
        if cached is not None:
            return cached
        # Memoiza ANTES de recursar para no romper con ciclos corruptos en datos.
        has_work_cache[node_id] = False
        result = bool(tasks_by_item.get(node_id)) or any(
            has_work(child_id) for child_id in children.get(node_id, [])
        )
        has_work_cache[node_id] = result
        return result

    weights: dict[UUID, float] = {}

    def assign(node_id: UUID | None, incoming_weight: float) -> None:
        kids = [c for c in children.get(node_id, []) if has_work(c)]
        own_tasks = tasks_by_item.get(node_id, [])
        units = len(kids) + len(own_tasks)
        if units == 0:
            return
        share = incoming_weight / units
        for task_id in own_tasks:
            weights[task_id] = share
        for child_id in kids:
            assign(child_id, share)

    assign(None, 1.0)
    return weights


def aggregate_progress_by_user(
    tasks: Iterable[WorkTask],
    weights: dict[UUID, float],
    team_member_ids: dict[UUID, list[UUID]],
) -> dict[UUID, MemberProgress]:
    """Agrega el peso de cada tarea al usuario (o a los miembros del equipo delegado)."""
    total_weight: dict[UUID, float] = {}
    completed_weight: dict[UUID, float] = {}
    tasks_total: dict[UUID, int] = {}
    tasks_completed: dict[UUID, int] = {}

    def add(user_id: UUID, weight: float, completed: bool) -> None:
        total_weight[user_id] = total_weight.get(user_id, 0.0) + weight
        tasks_total[user_id] = tasks_total.get(user_id, 0) + 1
        if completed:
            completed_weight[user_id] = completed_weight.get(user_id, 0.0) + weight
            tasks_completed[user_id] = tasks_completed.get(user_id, 0) + 1

    for task in tasks:
        weight = weights.get(task.id, 0.0)
        if task.assignee_id is not None:
            add(task.assignee_id, weight, task.is_completed)
        elif task.team_id is not None:
            members = team_member_ids.get(task.team_id, [])
            if not members:
                continue
            share = weight / len(members)
            for user_id in members:
                add(user_id, share, task.is_completed)
        # Sin responsable ni equipo: tarea aún no delegada, no cuenta para nadie.

    result: dict[UUID, MemberProgress] = {}
    for user_id, tw in total_weight.items():
        cw = completed_weight.get(user_id, 0.0)
        pct = round(cw / tw * 100) if tw > 0 else 0
        result[user_id] = MemberProgress(
            tasks_total=tasks_total.get(user_id, 0),
            tasks_completed=tasks_completed.get(user_id, 0),
            progress_pct=pct,
        )
    return result
