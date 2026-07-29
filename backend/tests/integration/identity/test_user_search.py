async def _create_user(
    client,
    headers,
    email,
    name,
    last_name,
    position="desarrollador",
    document_type=None,
    document_number=None,
):
    res = await client.post(
        "/api/v1/identity/users",
        json={
            "email": email,
            "password": "password123",
            "name": name,
            "last_name": last_name,
            "role": "user",
            "position": position,
            "document_type": document_type,
            "document_number": document_number,
        },
        headers=headers,
    )
    assert res.status_code == 201


class TestUserSearch:
    async def test_should_paginate_results(self, client, admin_headers):
        for i in range(7):
            await _create_user(
                client, admin_headers, f"user{i}@test.com", f"Nombre{i}", "Apellido"
            )

        res = await client.get(
            "/api/v1/identity/users/search?page=1&page_size=5", headers=admin_headers
        )
        assert res.status_code == 200
        body = res.json()
        assert body["page"] == 1
        assert body["page_size"] == 5
        assert len(body["items"]) == 5
        assert body["total"] >= 7

        res2 = await client.get(
            "/api/v1/identity/users/search?page=2&page_size=5", headers=admin_headers
        )
        # La segunda página trae el resto (no se repiten con la primera)
        ids_p1 = {u["id"] for u in body["items"]}
        ids_p2 = {u["id"] for u in res2.json()["items"]}
        assert ids_p1.isdisjoint(ids_p2)

    async def test_should_filter_by_name_email(self, client, admin_headers):
        await _create_user(
            client, admin_headers, "ana.busqueda@test.com", "Ana", "García"
        )
        await _create_user(client, admin_headers, "otro@test.com", "Pedro", "López")

        by_name = await client.get(
            "/api/v1/identity/users/search?search=Ana", headers=admin_headers
        )
        assert by_name.status_code == 200
        assert any(u["name"] == "Ana" for u in by_name.json()["items"])
        assert all("Pedro" != u["name"] for u in by_name.json()["items"])

        by_email = await client.get(
            "/api/v1/identity/users/search?search=ana.busqueda", headers=admin_headers
        )
        assert any(
            u["email"] == "ana.busqueda@test.com" for u in by_email.json()["items"]
        )

    async def test_should_filter_by_document_number(self, client, admin_headers):
        await _create_user(
            client,
            admin_headers,
            "cedula@test.com",
            "Cami",
            "Cédula",
            document_type="cedula_ciudadania",
            document_number="1098765432",
        )
        await _create_user(client, admin_headers, "sindoc@test.com", "Sin", "Doc")

        res = await client.get(
            "/api/v1/identity/users/search?search=1098765432", headers=admin_headers
        )
        assert res.status_code == 200
        items = res.json()["items"]
        assert any(u["document_number"] == "1098765432" for u in items)
        assert all(u["name"] != "Sin" for u in items)

    async def test_should_reject_duplicate_document(self, client, admin_headers):
        await _create_user(
            client,
            admin_headers,
            "primero@test.com",
            "Primero",
            "Persona",
            document_number="555000111",
        )
        # Otro usuario con el mismo documento: es la misma persona → rechazado.
        res = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "segundo@test.com",
                "password": "password123",
                "name": "Segundo",
                "last_name": "Intento",
                "role": "user",
                "position": "desarrollador",
                "document_number": "555000111",
            },
            headers=admin_headers,
        )
        assert res.status_code == 409, res.text

    async def test_should_filter_by_position(self, client, admin_headers):
        await _create_user(
            client, admin_headers, "dev@test.com", "Dev", "Uno", "desarrollador"
        )
        await _create_user(
            client, admin_headers, "disenio@test.com", "Dis", "Dos", "diseñador_grafico"
        )

        res = await client.get(
            "/api/v1/identity/users/search?position=diseñador_grafico",
            headers=admin_headers,
        )
        assert res.status_code == 200
        assert all(u["position"] == "diseñador_grafico" for u in res.json()["items"])

    async def test_should_clamp_page_size(self, client, admin_headers):
        res = await client.get(
            "/api/v1/identity/users/search?page_size=999", headers=admin_headers
        )
        assert res.status_code == 200
        assert res.json()["page_size"] <= 50

    async def test_should_require_authentication(self, client):
        res = await client.get("/api/v1/identity/users/search")
        assert res.status_code in (401, 403)
