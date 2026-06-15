async def _register_and_login(client) -> dict:
    await client.post(
        "/api/v1/identity/",
        json={
            "email": "refresh@example.com",
            "password": "password123",
            "name": "Ref",
            "last_name": "User",
            "role": "admin",
            "position": "desarrollador",
        },
    )
    res = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()


class TestRefreshRoute:
    async def test_should_issue_new_tokens_from_valid_refresh(self, client):
        tokens = await _register_and_login(client)

        res = await client.post(
            "/api/v1/identity/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )

        assert res.status_code == 200
        body = res.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["email"] == "refresh@example.com"

    async def test_new_access_token_works_on_protected_route(self, client):
        tokens = await _register_and_login(client)
        refreshed = (
            await client.post(
                "/api/v1/identity/auth/refresh",
                json={"refresh_token": tokens["refresh_token"]},
            )
        ).json()

        res = await client.get(
            "/api/v1/projects/",
            headers={"Authorization": f"Bearer {refreshed['access_token']}"},
        )
        assert res.status_code == 200

    async def test_should_reject_garbage_refresh_token(self, client):
        res = await client.post(
            "/api/v1/identity/auth/refresh",
            json={"refresh_token": "not-a-real-token"},
        )
        assert res.status_code == 401

    async def test_should_reject_access_token_used_as_refresh(self, client):
        tokens = await _register_and_login(client)
        # Mandar el access_token donde se espera un refresh_token → debe fallar
        res = await client.post(
            "/api/v1/identity/auth/refresh",
            json={"refresh_token": tokens["access_token"]},
        )
        assert res.status_code == 401
