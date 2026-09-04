from uuid import UUID


class TestCreateUserAdminRoute:
    """La plataforma es privada: no hay registro público, solo alta por
    administración (admin/super_admin/developer)."""

    async def test_should_create_user_successfully(self, client, admin_headers):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "nuevo@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert response.status_code == 201

        body = response.json()

        assert "id" in body
        assert "email" in body
        assert "name" in body
        assert "last_name" in body
        assert "role" in body
        assert "is_active" in body

        assert isinstance(body["id"], str)
        UUID(body["id"])

        assert body["email"] == "nuevo@example.com"
        assert body["name"] == "John"
        assert body["last_name"] == "Doe"
        assert body["role"] == "user"
        assert body["is_active"] is True

    async def test_should_require_authentication(self, client):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "sinauth@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "position": "desarrollador",
            },
        )
        assert response.status_code in (401, 403)

    async def test_should_return_422_when_email_is_invalid(self, client, admin_headers):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "invalid-email",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert response.status_code == 422

    async def test_email_is_normalized_to_lowercase_on_create(
        self, client, admin_headers
    ):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": " Mixed.Case@Example.COM ",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        assert response.json()["email"] == "mixed.case@example.com"

    async def test_duplicate_email_case_insensitive_returns_409(
        self, client, admin_headers
    ):
        first = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "duplicado@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert first.status_code == 201, first.text

        second = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "DUPLICADO@Example.com",
                "password": "password123",
                "name": "Jane",
                "last_name": "Roe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert second.status_code == 409

    async def test_missing_password_returns_activation_link(
        self, client, admin_headers
    ):
        # El admin no define la contraseña: no viaja ninguna credencial; se
        # devuelve un enlace de activación de un solo uso (también enviado por
        # correo) por si el correo no llega.
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "sinpassword@example.com",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        assert body["temporary_password"] is None
        assert "/activar?token=" in (body["activation_url"] or "")
        assert body["must_change_password"] is True

    async def test_account_activation_flow(self, client, admin_headers):
        # Alta sin contraseña → activar con el token → login con la clave elegida.
        created = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "poractivar@example.com",
                "name": "Por",
                "last_name": "Activar",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text
        token = created.json()["activation_url"].split("token=", 1)[1]

        info = await client.get(f"/api/v1/identity/activation/{token}")
        assert info.status_code == 200
        assert info.json()["email"] == "poractivar@example.com"

        done = await client.post(
            "/api/v1/identity/activation/complete",
            json={"token": token, "new_password": "elegida123"},
        )
        assert done.status_code == 200, done.text
        assert done.json()["access_token"]

        # El token es de un solo uso: ya no vale.
        reuse = await client.get(f"/api/v1/identity/activation/{token}")
        assert reuse.status_code == 401

        login = await client.post(
            "/api/v1/identity/auth/login",
            json={"email": "poractivar@example.com", "password": "elegida123"},
        )
        assert login.status_code == 200

    async def test_resend_activation_link_only_latest_token_works(
        self, client, admin_headers
    ):
        # Reenviar el correo de activación n veces reemplaza el token cada vez:
        # solo el último enlace emitido debe funcionar, los anteriores quedan
        # invalidados (no caducados, reemplazados) de inmediato.
        created = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "reenvios@example.com",
                "name": "Con",
                "last_name": "Reenvios",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text
        user_id = created.json()["id"]
        first_token = created.json()["activation_url"].split("token=", 1)[1]

        resends = []
        for _ in range(3):
            resp = await client.post(
                f"/api/v1/identity/users/{user_id}/activation-link",
                headers=admin_headers,
            )
            assert resp.status_code == 200, resp.text
            resends.append(resp.json()["activation_url"].split("token=", 1)[1])

        # El primer token (del alta) y los intermedios ya no valen.
        stale = await client.get(f"/api/v1/identity/activation/{first_token}")
        assert stale.status_code == 401
        for stale_token in resends[:-1]:
            resp = await client.get(f"/api/v1/identity/activation/{stale_token}")
            assert resp.status_code == 401

        # El último enlace emitido sigue siendo válido y activa la cuenta.
        latest_token = resends[-1]
        info = await client.get(f"/api/v1/identity/activation/{latest_token}")
        assert info.status_code == 200
        assert info.json()["email"] == "reenvios@example.com"

        done = await client.post(
            "/api/v1/identity/activation/complete",
            json={"token": latest_token, "new_password": "elegida123"},
        )
        assert done.status_code == 200, done.text

    async def test_resend_activation_link_rejected_once_account_is_active(
        self, client, admin_headers
    ):
        # El enlace de activación fija la contraseña sin pedir la actual: sobre
        # una cuenta ya activa equivaldría a un reseteo de contraseña sin rastro
        # de auditoría, así que reenviar debe rechazarse tras activar.
        created = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "yaactiva@example.com",
                "name": "Ya",
                "last_name": "Activa",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert created.status_code == 201, created.text
        user_id = created.json()["id"]
        token = created.json()["activation_url"].split("token=", 1)[1]

        done = await client.post(
            "/api/v1/identity/activation/complete",
            json={"token": token, "new_password": "elegida123"},
        )
        assert done.status_code == 200, done.text

        resend = await client.post(
            f"/api/v1/identity/users/{user_id}/activation-link",
            headers=admin_headers,
        )
        assert resend.status_code == 409

    async def test_should_return_422_when_role_is_invalid(self, client, admin_headers):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "rolinvalido@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "super-admin",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert response.status_code == 422

    async def test_should_return_404_when_position_does_not_exist(
        self, client, admin_headers
    ):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "cargoinvalido@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "cargo_que_no_existe",
            },
            headers=admin_headers,
        )

        assert response.status_code == 404

    async def test_should_return_conflict_when_email_already_exists(
        self,
        client,
        admin_headers,
    ):
        payload = {
            "email": "duplicado@example.com",
            "password": "password123",
            "name": "John",
            "last_name": "Doe",
            "role": "user",
            "position": "desarrollador",
        }

        await client.post(
            "/api/v1/identity/users",
            json=payload,
            headers=admin_headers,
        )

        response = await client.post(
            "/api/v1/identity/users",
            json=payload,
            headers=admin_headers,
        )

        assert response.status_code == 409

    async def test_developer_can_create_user(self, client, developer_headers):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "creado.por.developer@example.com",
                "password": "password123",
                "name": "Dev",
                "last_name": "Created",
                "role": "user",
                "position": "desarrollador",
            },
            headers=developer_headers,
        )

        assert response.status_code == 201, response.text

    async def test_regular_user_cannot_create_user(self, client, member_headers):
        response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "sinpermiso@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=member_headers,
        )

        assert response.status_code == 403


class TestLoginRoute:
    async def test_should_login_successfully(self, client, admin_headers):
        await client.post(
            "/api/v1/identity/users",
            json={
                "email": "login@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "login@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 200

        body = response.json()

        # Token contract
        assert "access_token" in body
        assert "refresh_token" in body
        assert "token_type" in body
        assert "user" in body

        # Token validation
        assert isinstance(body["access_token"], str)
        assert isinstance(body["refresh_token"], str)

        assert body["access_token"] != ""
        assert body["refresh_token"] != ""

        assert body["token_type"] == "bearer"

        # User validation
        user = body["user"]

        assert user["email"] == "login@example.com"
        assert user["name"] == "John"
        assert user["last_name"] == "Doe"
        assert user["role"] == "user"
        assert user["is_active"] is True

    async def test_should_return_401_when_password_is_invalid(
        self,
        client,
        admin_headers,
    ):
        await client.post(
            "/api/v1/identity/users",
            json={
                "email": "malacontra@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "malacontra@example.com",
                "password": "wrong-password",
            },
        )

        assert response.status_code == 401

    async def test_should_return_401_when_user_does_not_exist(
        self,
        client,
    ):
        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "notfound@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 401

    async def test_should_return_422_when_email_is_missing(
        self,
        client,
    ):
        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "password": "password123",
            },
        )

        assert response.status_code == 422

    async def test_should_return_422_when_password_is_missing(
        self,
        client,
    ):
        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "admin@example.com",
            },
        )

        assert response.status_code == 422


class TestPublicRegisterRemoved:
    """La plataforma es de uso interno/privado: el registro público ya no existe."""

    async def test_public_register_endpoint_is_gone(self, client):
        response = await client.post(
            "/api/v1/identity/",
            json={
                "email": "hacker@example.com",
                "password": "password123",
                "name": "Mal",
                "last_name": "Actor",
                "role": "user",
                "position": "desarrollador",
            },
        )
        assert response.status_code == 404
