"""E2E del feedback del sitio.

Flujo de usuario: un usuario autenticado envía feedback desde la app; el rol
DEVELOPER lo ve en su bandeja y le cambia el estado. Ni admin ni super_admin
acceden a la bandeja (es exclusiva del developer).
"""


async def _submit(
    client, headers, *, feedback_type="positivo", message="Todo funciona muy bien"
):
    return await client.post(
        "/api/v1/feedback/",
        json={"feedback_type": feedback_type, "message": message, "page": "/dashboard"},
        headers=headers,
    )


class TestFeedbackFlow:
    async def test_user_submits_then_developer_manages(
        self, client, member_headers, developer_headers
    ):
        # 1) El usuario envía feedback (estado inicial: pendiente).
        created = await _submit(
            client,
            member_headers,
            feedback_type="nueva_funcionalidad",
            message="Sería útil exportar a PDF",
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["feedback_type"] == "nueva_funcionalidad"
        assert body["status"] == "pendiente"
        feedback_id = body["id"]

        # 2) El developer lo ve en su bandeja.
        inbox = await client.get("/api/v1/feedback/", headers=developer_headers)
        assert inbox.status_code == 200, inbox.text
        assert inbox.json()["total"] >= 1

        # 3) El developer cambia el estado a "realizado".
        updated = await client.patch(
            f"/api/v1/feedback/{feedback_id}/status",
            json={"status": "realizado"},
            headers=developer_headers,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == "realizado"

    async def test_admin_cannot_access_inbox(
        self, client, member_headers, admin_headers
    ):
        await _submit(client, member_headers)
        denied = await client.get("/api/v1/feedback/", headers=admin_headers)
        assert denied.status_code == 403

    async def test_super_admin_cannot_access_inbox(self, client, super_admin_headers):
        denied = await client.get("/api/v1/feedback/", headers=super_admin_headers)
        assert denied.status_code == 403

    async def test_requires_authentication(self, client):
        anon = await _submit_anon(client)
        assert anon.status_code == 401

    async def test_rejects_too_short_message(self, client, member_headers):
        bad = await _submit(client, member_headers, message="x")
        assert bad.status_code == 422


async def _submit_anon(client):
    return await client.post(
        "/api/v1/feedback/",
        json={"feedback_type": "otro", "message": "comentario anónimo"},
    )
