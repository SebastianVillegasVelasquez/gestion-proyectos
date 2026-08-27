from uuid import uuid4


def _unique_label(prefix: str) -> str:
    # La tabla `positions` es catálogo persistente (no se trunca entre tests,
    # igual que `tipos_nodo`), así que cada test usa un cargo único para no
    # colisionar entre corridas (mismo patrón que los emails con uuid4).
    return f"{prefix} {uuid4().hex[:8]}"


def _slug(label: str) -> str:
    # La clave que el backend deriva del cargo escrito en texto plano.
    return label.strip().lower().replace(" ", "_")


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
        label = _unique_label("Community Manager")
        response = await client.post(
            "/api/v1/identity/positions",
            json={"label": label},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        # El administrador solo escribe el cargo: la clave la deriva el backend.
        assert response.json() == {"value": _slug(label), "label": label}

        listed = await client.get("/api/v1/identity/positions", headers=admin_headers)
        assert _slug(label) in {p["value"] for p in listed.json()}

    async def test_accented_label_is_kept_and_key_is_normalized(
        self, client, admin_headers
    ):
        label = _unique_label("Diseñador Gráfico")
        response = await client.post(
            "/api/v1/identity/positions",
            json={"label": label},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        # La etiqueta conserva las tildes tal como se escribieron...
        assert body["label"] == label
        # ...y la clave interna queda sin tildes (la ñ sí es válida en la clave).
        assert body["value"] == _slug(label).replace("á", "a")

    async def test_developer_can_create_a_new_position(self, client, developer_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"label": _unique_label("Growth Hacker")},
            headers=developer_headers,
        )
        assert response.status_code == 201, response.text

    async def test_new_position_can_be_used_to_create_a_user(
        self, client, admin_headers
    ):
        label = _unique_label("Chief of Staff")
        created = await client.post(
            "/api/v1/identity/positions",
            json={"label": label},
            headers=admin_headers,
        )
        assert created.status_code == 201
        key = created.json()["value"]

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

    async def test_rejects_duplicate_position(self, client, admin_headers):
        label = _unique_label("Cargo Duplicado")
        first = await client.post(
            "/api/v1/identity/positions", json={"label": label}, headers=admin_headers
        )
        assert first.status_code == 201

        # Misma clave derivada (mayúsculas/tildes distintas) ⇒ mismo cargo.
        second = await client.post(
            "/api/v1/identity/positions",
            json={"label": label.upper()},
            headers=admin_headers,
        )
        assert second.status_code == 409

    async def test_rejects_empty_label(self, client, admin_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"label": "a"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_regular_user_cannot_create_position(self, client, member_headers):
        response = await client.post(
            "/api/v1/identity/positions",
            json={"label": _unique_label("Otro cargo")},
            headers=member_headers,
        )
        assert response.status_code == 403
