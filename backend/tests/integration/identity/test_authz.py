"""E2E de autorización: jerarquía del rol DEVELOPER, restricciones del rol CLIENT
y límite de intentos en el login.
"""


class TestDeveloperHierarchy:
    async def test_developer_reaches_admin_only_endpoint(
        self, client, developer_headers
    ):
        # /users/manage está restringido a admin/super_admin; el developer pasa por
        # jerarquía (es el tope), sin estar listado explícitamente.
        resp = await client.get(
            "/api/v1/identity/users/manage", headers=developer_headers
        )
        assert resp.status_code == 200, resp.text


class TestClientRestrictions:
    async def test_client_blocked_from_admin_users(self, client, client_headers):
        resp = await client.get("/api/v1/identity/users/manage", headers=client_headers)
        assert resp.status_code == 403

    async def test_client_blocked_from_projects(self, client, client_headers):
        resp = await client.get("/api/v1/projects/", headers=client_headers)
        assert resp.status_code == 403


class TestLoginRateLimit:
    async def test_blocks_after_too_many_attempts(self, client):
        # 10 intentos permitidos por ventana; el 11º debe responder 429.
        # (credenciales inválidas: el límite cuenta antes de autenticar)
        payload = {"email": "noexiste@test.com", "password": "loquesea1"}
        statuses = []
        for _ in range(11):
            r = await client.post("/api/v1/identity/auth/login", json=payload)
            statuses.append(r.status_code)
        assert statuses[-1] == 429
        assert 429 not in statuses[:10]  # los primeros 10 no se bloquean
