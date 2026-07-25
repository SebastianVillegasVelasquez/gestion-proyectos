import io


def _csv_file(content: str, filename: str = "users.csv"):
    return {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")}


class TestBulkCreateUsers:
    async def test_creates_every_valid_row(self, client, admin_headers):
        csv_content = (
            "email,name,last_name,role,position\n"
            "ana@example.com,Ana,Garcia,user,desarrollador\n"
            "carlos@example.com,Carlos,Lopez,admin,sin_cargo\n"
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

        # Sin password en el CSV: se generó una temporal.
        assert all(u["temporary_password"] for u in body["created"])

        login = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "ana@example.com",
                "password": next(
                    u["temporary_password"]
                    for u in body["created"]
                    if u["email"] == "ana@example.com"
                ),
            },
        )
        assert login.status_code == 200

    async def test_partial_failure_does_not_block_valid_rows(
        self, client, admin_headers, member_user
    ):
        csv_content = (
            "email,name,last_name,role,position\n"
            "valido@example.com,Valid,Row,user,desarrollador\n"
            f"{member_user.email},Repetido,Correo,user,desarrollador\n"
            "sinCargo@example.com,Sin,Cargo,user,cargo_no_existe\n"
            "rolinvalido@example.com,Rol,Invalido,superusuario,desarrollador\n"
        )

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["total_rows"] == 4
        assert len(body["created"]) == 1
        assert body["created"][0]["email"] == "valido@example.com"
        assert len(body["failed"]) == 3
        failed_emails = {f["email"] for f in body["failed"]}
        assert failed_emails == {
            member_user.email,
            "sinCargo@example.com",
            "rolinvalido@example.com",
        }

    async def test_uses_password_from_csv_when_present(self, client, admin_headers):
        csv_content = (
            "email,name,last_name,role,position,password\n"
            "conpassword@example.com,Con,Password,user,desarrollador,Passw0rd1\n"
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

    async def test_regular_user_cannot_bulk_create(self, client, member_headers):
        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file("email,name,last_name\nx@example.com,X,Y\n"),
            headers=member_headers,
        )
        assert response.status_code == 403

    async def test_developer_can_bulk_create(self, client, developer_headers):
        csv_content = "email,name,last_name,role,position\ndev.bulk@example.com,Dev,Bulk,user,desarrollador\n"

        response = await client.post(
            "/api/v1/identity/users/bulk",
            files=_csv_file(csv_content),
            headers=developer_headers,
        )
        assert response.status_code == 201, response.text
        assert len(response.json()["created"]) == 1
