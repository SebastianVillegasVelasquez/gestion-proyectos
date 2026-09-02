import io


def _csv_file(content: str, filename: str = "users.csv"):
    return {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")}


class TestBulkCreateUsers:
    async def test_creates_every_valid_row(self, client, admin_headers):
        csv_content = (
            "email,nombre,apellido,cargo\n"
            "ana@example.com,Ana,Garcia,desarrollador\n"
            "carlos@example.com,Carlos,Lopez,sin_cargo\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["total_rows"] == 2
        assert len(body["created"]) == 2
        assert body["failed"] == []
        emails = {u["email"] for u in body["created"]}
        assert emails == {"ana@example.com", "carlos@example.com"}

        # Sin password en el CSV: NO viaja ninguna credencial en la respuesta;
        # cada persona recibe por correo un enlace de activación de un solo uso.
        assert all(u["temporary_password"] is None for u in body["created"])

    async def test_unknown_cargo_is_created_on_the_fly(self, client, admin_headers):
        csv_content = (
            "email,nombre,apellido,cargo\n"
            "nuevo.cargo@example.com,Nueva,Persona,Cargo Nunca Visto\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["failed"] == []
        assert len(body["created"]) == 1

        positions = await client.get(
            "/api/v1/identity/positions", headers=admin_headers
        )
        keys = {p["value"] for p in positions.json()}
        assert "cargo_nunca_visto" in keys

    async def test_cedula_is_optional(self, client, admin_headers):
        csv_content = "email,nombre,apellido\nsincedula@example.com,Sin,Cedula\n"

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["failed"] == []
        assert len(body["created"]) == 1

    async def test_partial_failure_does_not_block_valid_rows(
        self, client, admin_headers, member_user
    ):
        csv_content = (
            "email,nombre,apellido,cedula\n"
            "valido@example.com,Valid,Row,\n"
            f"{member_user.email},Repetido,Correo,\n"
            "cedularepetida@example.com,Cedula,Repetida,111222333\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["total_rows"] == 3
        assert len(body["created"]) == 2
        created_emails = {u["email"] for u in body["created"]}
        assert created_emails == {"valido@example.com", "cedularepetida@example.com"}
        assert len(body["failed"]) == 1
        assert body["failed"][0]["email"] == member_user.email

    async def test_uses_password_from_csv_when_present(self, client, admin_headers):
        csv_content = (
            "email,nombre,apellido,cargo,password\n"
            "conpassword@example.com,Con,Password,desarrollador,Passw0rd1\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        created = response.json()["created"][0]
        assert created["temporary_password"] is None

        login = await client.post(
            "/api/v1/identity/auth/login",
            json={"email": "conpassword@example.com", "password": "Passw0rd1"},
        )
        assert login.status_code == 200

    async def test_bulk_created_user_always_has_user_role(self, client, admin_headers):
        csv_content = "email,nombre,apellido\nsiemprerol@example.com,Siempre,Rol\n"

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        users = await client.get(
            "/api/v1/identity/users/manage",
            params={"search": "siemprerol@example.com"},
            headers=admin_headers,
        )
        matches = [
            u for u in users.json()["items"] if u["email"] == "siemprerol@example.com"
        ]
        assert matches and matches[0]["role"] == "user"

    async def test_regular_user_cannot_bulk_create(self, client, member_headers):
        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file("email,nombre,apellido\nx@example.com,X,Y\n"),
            headers=member_headers,
        )
        assert response.status_code == 403

    async def test_developer_can_bulk_create(self, client, developer_headers):
        csv_content = (
            "email,nombre,apellido,cargo\ndev.bulk@example.com,Dev,Bulk,desarrollador\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=developer_headers,
        )
        assert response.status_code == 201, response.text
        assert len(response.json()["created"]) == 1

    async def test_cargo_with_accent_and_without_resolve_to_one_position(
        self, client, admin_headers
    ):
        csv_content = (
            "email,nombre,apellido,cargo\n"
            "primera@example.com,Primera,Persona,Ingeniería\n"
            "segunda@example.com,Segunda,Persona,ingenieria\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["failed"] == []
        assert len(body["created"]) == 2

        positions = await client.get(
            "/api/v1/identity/positions", headers=admin_headers
        )
        matches = [p for p in positions.json() if p["value"] == "ingenieria"]
        # Una sola posición para ambas filas, y conserva la tilde tal como se
        # escribió la primera vez ("Ingeniería"), no la versión sin tilde.
        assert len(matches) == 1
        assert matches[0]["label"] == "Ingeniería"

    async def test_duplicate_email_within_same_file_is_reported_not_failed_batch(
        self, client, admin_headers
    ):
        csv_content = (
            "email,nombre,apellido\n"
            "repetido@example.com,Primera,Persona\n"
            "repetido@example.com,Segunda,Persona\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["total_rows"] == 2
        assert len(body["created"]) == 1
        assert body["created"][0]["email"] == "repetido@example.com"
        assert len(body["failed"]) == 1
        assert body["failed"][0]["row"] == 2
        assert "ya se encuentra registrado" in body["failed"][0]["error"]

    async def test_duplicate_email_case_insensitive_within_file(
        self, client, admin_headers
    ):
        csv_content = (
            "email,nombre,apellido\n"
            "Ana@Example.com,Ana,Garcia\n"
            "ana@example.com,Otra,Ana\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body["created"]) == 1
        assert body["created"][0]["email"] == "ana@example.com"
        assert len(body["failed"]) == 1
        assert body["failed"][0]["email"] == "ana@example.com"

    async def test_duplicate_email_case_insensitive_against_existing_user(
        self, client, admin_headers, member_user
    ):
        csv_content = (
            f"email,nombre,apellido\n{member_user.email.upper()},Otra,Persona\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["created"] == []
        assert len(body["failed"]) == 1
        assert "ya se encuentra registrado" in body["failed"][0]["error"]
