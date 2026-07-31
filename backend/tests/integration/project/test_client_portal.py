"""Portal público del cliente: token por proyecto + acceso de solo lectura.

Verifica el flujo completo end-to-end:
  crear proyecto → obtener token (admin) → consultar avance sin sesión (público)
  → regenerar token revoca el enlace anterior.
"""


async def _create_project(client, admin_headers, valid_project_payload) -> str:
    resp = await client.post(
        "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestClientPortal:
    async def test_admin_gets_a_client_token(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        resp = await client.get(
            f"/api/v1/projects/{project_id}/client-access", headers=admin_headers
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["token"]  # no vacío

    async def test_public_progress_needs_no_auth(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        token = (
            await client.get(
                f"/api/v1/projects/{project_id}/client-access", headers=admin_headers
            )
        ).json()["token"]

        # Sin cabeceras de autenticación: el token en el cuerpo es la única credencial.
        resp = await client.post(
            "/api/v1/public/projects/progress", json={"token": token}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["name"] == valid_project_payload["name"]
        assert body["progress_pct"] == 0  # proyecto recién creado, sin tareas
        # No debe filtrar identificadores internos ni tareas individuales.
        assert "id" not in body
        assert "my_tasks" not in body

    async def test_invalid_token_returns_404(self, client):
        resp = await client.post(
            "/api/v1/public/projects/progress", json={"token": "token-que-no-existe"}
        )
        assert resp.status_code == 404

    async def test_regenerate_revokes_previous_link(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        old_token = (
            await client.get(
                f"/api/v1/projects/{project_id}/client-access", headers=admin_headers
            )
        ).json()["token"]

        new_token = (
            await client.post(
                f"/api/v1/projects/{project_id}/client-access/regenerate",
                headers=admin_headers,
            )
        ).json()["token"]

        assert new_token != old_token
        # El enlace viejo deja de funcionar; el nuevo sí.
        assert (
            await client.post(
                "/api/v1/public/projects/progress", json={"token": old_token}
            )
        ).status_code == 404
        assert (
            await client.post(
                "/api/v1/public/projects/progress", json={"token": new_token}
            )
        ).status_code == 200

    async def test_client_access_requires_admin(
        self, client, member_headers, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        resp = await client.get(
            f"/api/v1/projects/{project_id}/client-access", headers=member_headers
        )
        assert resp.status_code == 403

    async def test_public_schedule_needs_no_auth(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        token = (
            await client.get(
                f"/api/v1/projects/{project_id}/client-access", headers=admin_headers
            )
        ).json()["token"]

        # Sin cabeceras de autenticación: el token en el cuerpo es la única credencial.
        resp = await client.post(
            "/api/v1/public/projects/schedule", json={"token": token}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["project_name"] == valid_project_payload["name"]
        # Proyecto recién creado: sin estructura fechada todavía.
        assert body["items"] == []
        # El cronograma es la estructura, no las tareas ni quién las ejecuta.
        assert "tasks" not in body
        assert "assignee" not in body
        assert "team" not in body

    async def test_public_schedule_invalid_token_returns_404(self, client):
        resp = await client.post(
            "/api/v1/public/projects/schedule",
            json={"token": "token-que-no-existe"},
        )
        assert resp.status_code == 404
