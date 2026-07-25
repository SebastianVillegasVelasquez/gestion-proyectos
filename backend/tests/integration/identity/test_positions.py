from uuid import uuid4


def _unique_key(prefix: str) -> str:
    # La tabla `positions` es catálogo persistente (no se trunca entre tests,
    # igual que `tipos_nodo`), así que cada test usa una clave única para no
    # colisionar entre corridas (mismo patrón que los emails con uuid4).
    return f"{prefix}_{uuid4().hex[:8]}"


class TestListPositions:
    async def test_should_list_seeded_positions(self, client, admin_headers):
        response = await client.get("/api/v1/identity/positions", headers=admin_headers)

        assert response.status_code == 200
        values = {p["value"] for p in response.json()}
        assert "desarrollador" in values
        assert "sin_cargo" in values

    async def test_should_require_authentication(self, client):
        response = await client.get("/api/v1/identity/positions")
        assert response.status_code in (401, 403)


class TestCreatePosition:
    async def test_admin_can_create_a_new_position(self, client, admin_headers):
        key = _unique_key("community_manager")
        response = await client.post(
            "/api/v1/identity/positions",
            json={"key": key, "label": "Community Manager"},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        assert response.json() == {"value": key, "label": "Community Manager"}

        listed = await client.get("/api/v1/identity/positions", headers=admin_headers)
        assert key in {p["value"] for p in listed.json()}

    async def test_developer_can_create_a_new_position(self, client, developer_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"key": _unique_key("growth_hacker"), "label": "Growth Hacker"},
            headers=developer_headers,
        )
        assert response.status_code == 201, response.text

    async def test_new_position_can_be_used_to_create_a_user(
        self, client, admin_headers
    ):
        key = _unique_key("chief_of_staff")
        created = await client.post(
            "/api/v1/identity/positions",
            json={"key": key, "label": "Chief of Staff"},
            headers=admin_headers,
        )
        assert created.status_code == 201

        user = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "chief@example.com",
                "password": "password123",
                "name": "Ana",
                "last_name": "Jefa",
                "role": "user",
                "position": key,
            },
            headers=admin_headers,
        )
        assert user.status_code == 201, user.text
        assert user.json()["position"] == key

    async def test_rejects_duplicate_key(self, client, admin_headers):
        payload = {"key": _unique_key("duplicado_cargo"), "label": "Cargo Duplicado"}
        first = await client.post(
            "/api/v1/identity/positions", json=payload, headers=admin_headers
        )
        assert first.status_code == 201

        second = await client.post(
            "/api/v1/identity/positions", json=payload, headers=admin_headers
        )
        assert second.status_code == 409

    async def test_rejects_invalid_key_format(self, client, admin_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"key": "Con Espacios Y Mayúsculas", "label": "Cargo raro"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_regular_user_cannot_create_position(self, client, member_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"key": _unique_key("otro_cargo"), "label": "Otro cargo"},
            headers=member_headers,
        )
        assert response.status_code == 403
