"""E2E — Historia completa: un organizador arma un proyecto de cero y lo pone en marcha.

Encadena, como lo haría un usuario real, las features que alimentan el CRONOGRAMA
(Gantt) del frontend:

  proyecto  →  tipo de nodo  →  árbol de trabajo con fechas  →  tareas con
  responsable, fechas y dependencia  →  el integrante entrega (flujo de estado).

El Gantt no es un endpoint: el frontend lo dibuja con los work_items (fechas
planificadas) + las tasks (fechas/estado) + las dependencias. Este test verifica
que toda esa base de datos se crea y se consulta correctamente de punta a punta.
"""

from datetime import date, timedelta

# Fechas relativas a hoy (fijas → la suite se rompería al alcanzarlas en el
# calendario). El "mes que viene" del organizador de la historia.
BASE = date.today() + timedelta(days=30)


def _day(offset: int) -> str:
    return (BASE + timedelta(days=offset)).isoformat()


async def _post(client, headers, url, body, expected=201):
    resp = await client.post(url, json=body, headers=headers)
    assert resp.status_code == expected, resp.text
    return resp.json()


class TestProjectLifecycleJourney:
    async def test_organizer_builds_and_starts_a_project(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        # 1. El organizador crea el proyecto.
        project = await _post(
            client, admin_headers, "/api/v1/projects/", valid_project_payload
        )
        project_id = project["id"]

        # 2. Define un tipo de nodo y arma el árbol: un "Módulo" con fecha de inicio
        #    y duración → el motor de fechas deriva la fecha de fin (dato del Gantt).
        tipo_id = (
            await _post(
                client,
                admin_headers,
                f"/api/v1/projects/{project_id}/node-types",
                {"nombre": "Módulo"},
            )
        )["id"]
        modulo = await _post(
            client,
            admin_headers,
            f"/api/v1/projects/{project_id}/work-items",
            {
                "tipo_id": tipo_id,
                "nombre": "Módulo 1",
                "fecha_inicio_plan": _day(0),
                "duracion_valor": 10,
                "duracion_unidad": "dias",
            },
        )
        work_item_id = modulo["id"]
        assert modulo["fecha_inicio_plan"] == _day(0)
        assert modulo["fecha_fin_plan"] == _day(10)  # inicio + 10 días

        # 3. Crea dos tareas bajo el módulo, asignadas al integrante; la 2ª depende
        #    de la 1ª (finish-to-start: la flecha que dibuja el Gantt).
        guion = await _post(
            client,
            admin_headers,
            "/api/v1/tasks",
            {
                "title": "Diseñar guion",
                "work_item_id": work_item_id,
                "assignee_id": str(member_user.id),
                "start_date": _day(0),
                "duration_days": 3,
            },
        )
        task1_id = guion["id"]
        assert guion["due_date"] == _day(3)  # inicio + 3 días

        grabar = await _post(
            client,
            admin_headers,
            "/api/v1/tasks",
            {
                "title": "Grabar video",
                "work_item_id": work_item_id,
                "assignee_id": str(member_user.id),
                "start_date": _day(3),
                "duration_days": 2,
                "depends_on_id": task1_id,
            },
        )
        task2_id = grabar["id"]

        # La dependencia quedó registrada (el Gantt la usa para la flecha).
        deps = await client.get(
            f"/api/v1/tasks/{task2_id}/dependencies", headers=admin_headers
        )
        assert deps.status_code == 200
        assert any(d["depends_on_id"] == task1_id for d in deps.json())

        # 4. El cronograma del frontend consume las tareas del proyecto: deben estar
        #    todas, con sus fechas.
        tasks = await client.get(
            f"/api/v1/projects/{project_id}/tasks", headers=admin_headers
        )
        assert tasks.status_code == 200, tasks.text
        by_title = {t["title"]: t for t in tasks.json()}
        assert {"Diseñar guion", "Grabar video"} <= set(by_title)
        assert by_title["Diseñar guion"]["start_date"] == _day(0)

        # 5. El integrante avanza su tarea: pendiente → en progreso → en revisión
        #    (entrega). Lo hace él mismo (rol user), no el admin.
        progreso = await client.patch(
            f"/api/v1/tasks/{task1_id}/status",
            json={"status": "en_progreso"},
            headers=member_headers,
        )
        assert progreso.status_code == 200, progreso.text

        revision = await client.patch(
            f"/api/v1/tasks/{task1_id}/status",
            json={"status": "en_revision"},
            headers=member_headers,
        )
        assert revision.status_code == 200, revision.text
        assert revision.json()["status"] == "en_revision"
