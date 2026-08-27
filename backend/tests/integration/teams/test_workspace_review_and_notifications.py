"""Vistas de equipo: rechazo de entregables y preferencias de aviso.

Cubre dos reglas nuevas:

* "Rechazar" es un estado distinto de "solicitar cambios" en el entregable,
  aunque ambos devuelvan la Task vinculada al integrante.
* Las notificaciones se guardan por (equipo, usuario): sin fila, todo activado.
"""

from uuid import uuid4

from app.modules.tasks.infrastructure.enums import TaskStatus

# Reutiliza el escenario ya montado (equipo con integrante + líder + admin).
from tests.integration.teams.test_workspace import scenario  # noqa: F401
from tests.integration.teams.test_workspace_task_link import _headers_for, _make_task

BASE = "/api/v1/teams"


async def _deliverable_with_version(
    client, team_id, headers, assignee_id, task_id=None
):
    """Entregable ya entregado: solo entonces tiene sentido revisarlo."""
    payload = {"task_title": f"Prototipo {uuid4()}", "assignee_id": str(assignee_id)}
    if task_id is not None:
        payload["task_id"] = str(task_id)

    created = await client.post(
        f"{BASE}/{team_id}/deliverables", json=payload, headers=headers
    )
    assert created.status_code == 201, created.text
    deliverable_id = created.json()["id"]

    version = await client.post(
        f"{BASE}/{team_id}/deliverables/{deliverable_id}/versions",
        json={"type": "enlace", "url": "https://ejemplo.com/v1"},
        headers=headers,
    )
    assert version.status_code == 201, version.text
    return deliverable_id


class TestRejectDeliverable:
    async def test_reject_sets_rechazado_and_returns_the_task(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        deliverable_id = await _deliverable_with_version(
            client, s.team.id, integrante_h, s.integrante.id, task.id
        )

        rejected = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={
                "content": "El enfoque no sirve, hay que replantearlo",
                "type": "rechazo",
            },
            headers=lider_h,
        )
        assert rejected.status_code == 201, rejected.text
        assert rejected.json()["status"] == "rechazado"

        # La tarea vuelve al integrante, igual que con una solicitud de cambios.
        await db_session.refresh(task)
        assert task.status == TaskStatus.DEVUELTA

    async def test_reject_and_request_changes_are_different_states(
        self, client, scenario
    ):
        """Misma consecuencia sobre la tarea, distinta lectura del entregable."""
        s = scenario
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        for comment_type, expected in (
            ("solicitud_cambio", "cambios_solicitados"),
            ("rechazo", "rechazado"),
        ):
            deliverable_id = await _deliverable_with_version(
                client, s.team.id, integrante_h, s.integrante.id
            )
            res = await client.post(
                f"{BASE}/{s.team.id}/deliverables/{deliverable_id}/comments",
                json={"content": "Motivo", "type": comment_type},
                headers=lider_h,
            )
            assert res.json()["status"] == expected

    async def test_integrante_cannot_reject(self, client, scenario):
        """Rechazar es revisión: solo líder o supervisor."""
        s = scenario
        integrante_h = await _headers_for(s.integrante)
        deliverable_id = await _deliverable_with_version(
            client, s.team.id, integrante_h, s.integrante.id
        )

        res = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={"content": "Me rechazo a mí mismo", "type": "rechazo"},
            headers=integrante_h,
        )
        assert res.status_code == 403

    async def test_resubmit_after_reject_returns_to_review(self, client, scenario):
        """El flujo rechazo → nueva entrega sigue vivo: no es un estado terminal."""
        s = scenario
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        deliverable_id = await _deliverable_with_version(
            client, s.team.id, integrante_h, s.integrante.id
        )
        await client.post(
            f"{BASE}/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={"content": "No sirve", "type": "rechazo"},
            headers=lider_h,
        )

        resubmitted = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com/v2"},
            headers=integrante_h,
        )
        assert resubmitted.status_code == 201
        assert resubmitted.json()["status"] == "en_revision"
        assert len(resubmitted.json()["versions"]) == 2


class TestMyTeamsExposesProject:
    async def test_mine_includes_project_id(self, client, scenario):
        """La Configuración del Grupo necesita el proyecto para gestionar el equipo."""
        s = scenario
        r = await client.get(f"{BASE}/mine", headers=await _headers_for(s.integrante))
        assert r.status_code == 200
        assert r.json()[0]["project_id"] is not None


class TestNotificationSettings:
    async def test_defaults_to_everything_on_without_a_stored_row(
        self, client, scenario
    ):
        s = scenario
        r = await client.get(
            f"{BASE}/{s.team.id}/workspace/notifications",
            headers=await _headers_for(s.integrante),
        )
        assert r.status_code == 200
        assert all(r.json().values())

    async def test_member_updates_and_reads_back_their_own_settings(
        self, client, scenario
    ):
        s = scenario
        headers = await _headers_for(s.integrante)
        body = {
            "nueva_tarea_asignada": False,
            "entregable_rechazado": True,
            "comentario_nuevo": False,
            "entregable_aprobado": True,
        }

        updated = await client.put(
            f"{BASE}/{s.team.id}/workspace/notifications", json=body, headers=headers
        )
        assert updated.status_code == 200
        assert updated.json() == body

        # Segundo PUT: el recurso se reemplaza, no se acumulan filas.
        again = await client.put(
            f"{BASE}/{s.team.id}/workspace/notifications",
            json={**body, "comentario_nuevo": True},
            headers=headers,
        )
        assert again.json()["comentario_nuevo"] is True

        read_back = await client.get(
            f"{BASE}/{s.team.id}/workspace/notifications", headers=headers
        )
        assert read_back.json()["nueva_tarea_asignada"] is False

    async def test_settings_are_per_user(self, client, scenario):
        """Apagar un aviso no debe silenciar a los compañeros de equipo."""
        s = scenario
        body = {
            "nueva_tarea_asignada": False,
            "entregable_rechazado": False,
            "comentario_nuevo": False,
            "entregable_aprobado": False,
        }
        await client.put(
            f"{BASE}/{s.team.id}/workspace/notifications",
            json=body,
            headers=await _headers_for(s.integrante),
        )

        other = await client.get(
            f"{BASE}/{s.team.id}/workspace/notifications",
            headers=await _headers_for(s.lider),
        )
        assert all(other.json().values())

    async def test_admin_observer_cannot_set_notifications(self, client, scenario):
        """El admin observa el equipo, pero no pertenece: no tiene avisos que ajustar."""
        s = scenario
        res = await client.put(
            f"{BASE}/{s.team.id}/workspace/notifications",
            json={
                "nueva_tarea_asignada": False,
                "entregable_rechazado": False,
                "comentario_nuevo": False,
                "entregable_aprobado": False,
            },
            headers=await _headers_for(s.admin),
        )
        assert res.status_code == 403

    async def test_outsider_cannot_read_notifications(self, client, scenario):
        s = scenario
        res = await client.get(
            f"{BASE}/{s.team.id}/workspace/notifications",
            headers=await _headers_for(s.outsider),
        )
        assert res.status_code == 403
