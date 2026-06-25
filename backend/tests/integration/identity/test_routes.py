from uuid import UUID


class TestCreateUserRoute:
    async def test_should_create_user_successfully(self, client):
        response = await client.post(
            "/api/v1/identity/",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
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

        assert body["email"] == "admin@example.com"
        assert body["name"] == "John"
        assert body["last_name"] == "Doe"
        # Seguridad: el registro PÚBLICO ignora el rol enviado y crea siempre USER
        # (la creación con rol vive en POST /identity/users, solo admin).
        assert body["role"] == "user"

        assert body["is_active"] is True

    async def test_should_return_422_when_email_is_invalid(self, client):
        response = await client.post(
            "/api/v1/identity/",
            json={
                "email": "invalid-email",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
        )

        assert response.status_code == 422

    async def test_should_return_422_when_password_is_missing(self, client):
        response = await client.post(
            "/api/v1/identity/",
            json={
                "email": "admin@example.com",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
        )

        assert response.status_code == 422

    async def test_should_return_422_when_role_is_invalid(self, client):
        response = await client.post(
            "/api/v1/identity/",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "super-admin",
                "position": "desarrollador",
            },
        )

        assert response.status_code == 422

    async def test_should_return_conflict_when_email_already_exists(
        self,
        client,
    ):
        payload = {
            "email": "admin@example.com",
            "password": "password123",
            "name": "John",
            "last_name": "Doe",
            "role": "admin",
            "position": "desarrollador",
        }

        await client.post(
            "/api/v1/identity/",
            json=payload,
        )

        response = await client.post(
            "/api/v1/identity/",
            json=payload,
        )

        assert response.status_code == 409


class TestLoginRoute:
    async def test_should_login_successfully(self, client):
        await client.post(
            "/api/v1/identity/",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
        )

        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "admin@example.com",
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

        assert user["email"] == "admin@example.com"
        assert user["name"] == "John"
        assert user["last_name"] == "Doe"
        # El registro público crea USER (ver nota de seguridad arriba).
        assert user["role"] == "user"
        assert user["is_active"] is True

    async def test_should_return_401_when_password_is_invalid(
        self,
        client,
    ):
        await client.post(
            "/api/v1/identity/",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
        )

        response = await client.post(
            "/api/v1/identity/auth/login",
            json={
                "email": "admin@example.com",
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
