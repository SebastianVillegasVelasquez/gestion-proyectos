async def _login(client, email, password):
    return await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )


class TestChangeOwnPassword:
    async def test_change_then_old_fails_and_new_works(
        self, client, member_user, member_headers
    ):
        changed = await client.patch(
            "/api/v1/identity/me/password",
            json={"current_password": "Member123*", "new_password": "NuevaClave9"},
            headers=member_headers,
        )
        assert changed.status_code == 204, changed.text

        old = await _login(client, "member@test.com", "Member123*")
        assert old.status_code == 401

        new = await _login(client, "member@test.com", "NuevaClave9")
        assert new.status_code == 200, new.text

    async def test_wrong_current_password_is_rejected(
        self, client, member_user, member_headers
    ):
        resp = await client.patch(
            "/api/v1/identity/me/password",
            json={"current_password": "incorrecta1", "new_password": "NuevaClave9"},
            headers=member_headers,
        )
        assert resp.status_code == 401


class TestAdminResetPassword:
    async def test_admin_resets_and_user_logs_in_with_temp(
        self, client, member_user, super_admin_headers
    ):
        reset = await client.post(
            f"/api/v1/identity/users/{member_user.id}/reset-password",
            headers=super_admin_headers,
        )
        assert reset.status_code == 200, reset.text
        temp = reset.json()["temporary_password"]
        assert temp

        login = await _login(client, "member@test.com", temp)
        assert login.status_code == 200, login.text

    async def test_reset_requires_admin(self, client, member_user, member_headers):
        denied = await client.post(
            f"/api/v1/identity/users/{member_user.id}/reset-password",
            headers=member_headers,
        )
        assert denied.status_code == 403


class TestAdminCreateUser:
    async def test_admin_creates_user_with_role(self, client, super_admin_headers):
        resp = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "nuevo.admin@test.com",
                "password": "Passw0rd1",
                "name": "Nuevo",
                "last_name": "Admin",
                "role": "admin",
            },
            headers=super_admin_headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["role"] == "admin"

    async def test_non_admin_cannot_create_user(self, client, member_headers):
        resp = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "x@test.com",
                "password": "Passw0rd1",
                "name": "X",
                "last_name": "Y",
                "role": "user",
            },
            headers=member_headers,
        )
        assert resp.status_code == 403


class TestManageUsersPagination:
    async def test_paginates_and_searches(
        self, client, super_admin_user, super_admin_headers
    ):
        # Creamos 2 usuarios identificables.
        for i in range(2):
            await client.post(
                "/api/v1/identity/users",
                json={
                    "email": f"paginado{i}@test.com",
                    "password": "Passw0rd1",
                    "name": f"Paginado{i}",
                    "last_name": "Prueba",
                    "role": "user",
                },
                headers=super_admin_headers,
            )

        page = await client.get(
            "/api/v1/identity/users/manage?page=1&page_size=1",
            headers=super_admin_headers,
        )
        assert page.status_code == 200, page.text
        body = page.json()
        assert body["page_size"] == 1
        assert len(body["items"]) == 1
        assert body["total"] >= 3  # super_admin + 2 creados
        assert {"role", "is_active"} <= set(body["items"][0].keys())

        search = await client.get(
            "/api/v1/identity/users/manage?search=Paginado1",
            headers=super_admin_headers,
        )
        assert search.status_code == 200
        assert search.json()["total"] == 1

    async def test_manage_requires_admin(self, client, member_headers):
        denied = await client.get(
            "/api/v1/identity/users/manage", headers=member_headers
        )
        assert denied.status_code == 403


class TestManageUsersSortingAndFilters:
    """Orden y filtro de inactivos: se resuelven en el servidor porque la
    lista viene paginada (ordenar la página ya recibida daría un orden falso).
    """

    async def _create(self, client, headers, email, name):
        resp = await client.post(
            "/api/v1/identity/users",
            json={
                "email": email,
                "password": "Passw0rd1",
                "name": name,
                "last_name": "Orden",
                "role": "user",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()

    async def test_includes_created_at(self, client, super_admin_headers):
        await self._create(client, super_admin_headers, "fecha@test.com", "Fecha")

        page = await client.get(
            "/api/v1/identity/users/manage?search=fecha@test.com",
            headers=super_admin_headers,
        )
        assert page.status_code == 200, page.text
        assert page.json()["items"][0]["created_at"] is not None

    async def test_sorts_by_email_descending(self, client, super_admin_headers):
        await self._create(client, super_admin_headers, "aaa.orden@test.com", "Ana")
        await self._create(client, super_admin_headers, "zzz.orden@test.com", "Zoe")

        page = await client.get(
            "/api/v1/identity/users/manage?search=orden@test.com"
            "&sort_by=email&sort_dir=desc",
            headers=super_admin_headers,
        )
        assert page.status_code == 200, page.text
        emails = [u["email"] for u in page.json()["items"]]
        assert emails == sorted(emails, reverse=True)

    async def test_can_exclude_inactive_users(self, client, super_admin_headers):
        created = await self._create(
            client, super_admin_headers, "inactivo.orden@test.com", "Ina"
        )
        patched = await client.patch(
            f"/api/v1/identity/users/{created['id']}",
            json={
                # PATCH pide los datos base además del cambio (igual que la UI).
                "email": created["email"],
                "name": created["name"],
                "last_name": created["last_name"],
                "is_active": False,
            },
            headers=super_admin_headers,
        )
        assert patched.status_code == 200, patched.text

        hidden = await client.get(
            "/api/v1/identity/users/manage"
            "?search=inactivo.orden@test.com&include_inactive=false",
            headers=super_admin_headers,
        )
        assert hidden.json()["total"] == 0

        shown = await client.get(
            "/api/v1/identity/users/manage"
            "?search=inactivo.orden@test.com&include_inactive=true",
            headers=super_admin_headers,
        )
        assert shown.json()["total"] == 1

    async def test_rejects_unknown_sort_column(self, client, super_admin_headers):
        # El enum del enrutador corta la entrada inválida antes del ORDER BY.
        resp = await client.get(
            "/api/v1/identity/users/manage?sort_by=password",
            headers=super_admin_headers,
        )
        assert resp.status_code == 422
