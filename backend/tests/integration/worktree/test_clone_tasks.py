"""Clonado PROFUNDO de un subárbol con sus tareas (`include_tasks`).

El clon debe ser una réplica fiel: además de la jerarquía de elementos, se
copian las tareas y TODAS sus subtareas a cualquier profundidad, conservando la
estimación de esfuerzo en días, el orden, si requieren aprobación y si la tarea
ES su elemento (`represents_work_item`). Las dependencias FtS internas al
subárbol se recrean entre los clones (tarea→tarea y tarea→elemento); las que
apuntan fuera se descartan. El estado y las fechas reales se resetean y las
fechas plan se desplazan `offset_days`.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)

BASE = date.today() + timedelta(days=30)


async def _task(client, headers, project_id, title, **extra) -> dict:
    body = {"title": title, "project_id": project_id, **extra}
    r = await client.post("/api/v1/tasks", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _flatten(nodes, acc=None):
    acc = acc if acc is not None else []
    for n in nodes:
        acc.append(n)
        _flatten(n["children"], acc)
    return acc


class TestCloneWithTasksDeepCopy:
    async def test_clone_replicates_tasks_subtasks_estimates_and_deps(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        t_mod = await _create_tipo(client, admin_headers, pid, "Módulo")
        t_fase = await _create_tipo(client, admin_headers, pid, "Fase")

        modulo = await _create_item(client, admin_headers, pid, t_mod, "M1")
        fase = await _create_item(
            client, admin_headers, pid, t_fase, "F1", modulo["id"]
        )

        # Tarea con estimación + aprobación, colgada de la fase.
        parent = await _task(
            client,
            admin_headers,
            pid,
            "Grabar",
            work_item_id=fase["id"],
            estimated_days="3.5",
            requires_approval=True,
            start_date=BASE.isoformat(),
            duration_days=4,
        )
        # Subtarea anidada (a cualquier profundidad).
        await _task(
            client,
            admin_headers,
            pid,
            "Grabar intro",
            work_item_id=fase["id"],
            parent_task_id=parent["id"],
            estimated_days="1",
        )
        # Segunda tarea que depende (FtS) de la primera → dependencia interna.
        await _task(
            client,
            admin_headers,
            pid,
            "Editar",
            work_item_id=fase["id"],
            depends_on_id=parent["id"],
        )
        # Tarea que depende de un ELEMENTO del subárbol clonado.
        await _task(
            client,
            admin_headers,
            pid,
            "Publicar",
            work_item_id=fase["id"],
            depends_on_work_item_id=modulo["id"],
        )

        clone = await client.post(
            f"/api/v1/work-items/{modulo['id']}/clone",
            headers=admin_headers,
            json={
                "rename_root_to": "M1 copia",
                "offset_days": 7,
                "include_tasks": True,
            },
        )
        assert clone.status_code == 201, clone.text

        tree = (
            await client.get(
                f"/api/v1/projects/{pid}/work-items", headers=admin_headers
            )
        ).json()
        cloned_root = next(n for n in tree if n["nombre"] == "M1 copia")
        cloned_ids = {n["id"] for n in _flatten([cloned_root])}
        cloned_fase_id = cloned_root["children"][0]["id"]

        all_tasks = (
            await client.get(f"/api/v1/projects/{pid}/tasks", headers=admin_headers)
        ).json()
        cloned_tasks = {
            t["title"]: t for t in all_tasks if t["work_item_id"] in cloned_ids
        }
        # Las 4 tareas se replicaron.
        assert set(cloned_tasks) == {"Grabar", "Grabar intro", "Editar", "Publicar"}

        c_parent = cloned_tasks["Grabar"]
        assert c_parent["work_item_id"] == cloned_fase_id
        assert str(c_parent["estimated_days"]) == "3.50"
        assert c_parent["requires_approval"] is True
        assert c_parent["status"] == "pendiente_por_iniciar"
        # Fecha plan desplazada 7 días, sin fechas reales.
        assert c_parent["due_date"] == (BASE + timedelta(days=4 + 7)).isoformat()
        assert c_parent["completed_at"] is None

        # La subtarea cuelga del clon del padre, no del original.
        c_sub = cloned_tasks["Grabar intro"]
        assert c_sub["parent_task_id"] == c_parent["id"]
        assert str(c_sub["estimated_days"]) == "1.00"

        # Dependencias FtS internas recreadas, apuntando a los clones.
        deps = (
            await client.get(
                f"/api/v1/projects/{pid}/task-dependencies", headers=admin_headers
            )
        ).json()
        by_task = {}
        for d in deps:
            by_task.setdefault(d["task_id"], []).append(d)

        c_dependent = cloned_tasks["Editar"]
        assert [x["depends_on_id"] for x in by_task[c_dependent["id"]]] == [
            c_parent["id"]
        ]

        c_wi_dependent = cloned_tasks["Publicar"]
        assert [
            x["depends_on_work_item_id"] for x in by_task[c_wi_dependent["id"]]
        ] == [cloned_root["id"]]

    async def test_clone_element_as_task_keeps_represents_flag(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        t_mod = await _create_tipo(client, admin_headers, pid, "Módulo")
        modulo = await _create_item(client, admin_headers, pid, t_mod, "M1")
        await _task(
            client,
            admin_headers,
            pid,
            "M1",
            work_item_id=modulo["id"],
            represents_work_item=True,
        )

        clone = await client.post(
            f"/api/v1/work-items/{modulo['id']}/clone",
            headers=admin_headers,
            json={"rename_root_to": "M1 copia", "include_tasks": True},
        )
        assert clone.status_code == 201, clone.text

        tree = (
            await client.get(
                f"/api/v1/projects/{pid}/work-items", headers=admin_headers
            )
        ).json()
        cloned_root = next(n for n in tree if n["nombre"] == "M1 copia")

        all_tasks = (
            await client.get(f"/api/v1/projects/{pid}/tasks", headers=admin_headers)
        ).json()
        c_task = next(t for t in all_tasks if t["work_item_id"] == cloned_root["id"])
        assert c_task["represents_work_item"] is True
