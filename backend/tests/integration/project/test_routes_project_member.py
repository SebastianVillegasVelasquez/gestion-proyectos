from app.modules.project.infrastructure.enums import ProjectRole


class TestRoutesProjectMember:
    async def test_should_add_member_to_project(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )

        assert project_response.status_code == 201

        user_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert user_response.status_code == 201

        project = project_response.json()
        user = user_response.json()

        member_response = await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.INTEGRANTE.value,
            },
            headers=admin_headers,
        )

        assert member_response.status_code == 201

        member = member_response.json()

        assert member["user_id"] == user["id"]
        assert member["project_role"] == "integrante"
        assert member["name"] == user["name"]

    async def test_should_reject_duplicate_member(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        project = (
            await client.post(
                "/api/v1/projects/",
                json=valid_project_payload,
                headers=admin_headers,
            )
        ).json()

        user = (
            await client.post(
                "/api/v1/identity/users",
                json={
                    "email": "dup@example.com",
                    "password": "password123",
                    "name": "Dup",
                    "last_name": "Licado",
                    "role": "user",
                    "position": "desarrollador",
                },
                headers=admin_headers,
            )
        ).json()

        payload = {
            "user_id": user["id"],
            "project_id": project["id"],
            "project_role": ProjectRole.INTEGRANTE.value,
        }
        first = await client.post(
            "/api/v1/projects/members/", json=payload, headers=admin_headers
        )
        assert first.status_code == 201

        # Segundo intento con el mismo usuario: alta duplicada rechazada.
        second = await client.post(
            "/api/v1/projects/members/", json=payload, headers=admin_headers
        )
        assert second.status_code == 409, second.text

    async def test_readding_member_after_removal_allows_team_assignment(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        """Regresión: quitar y volver a añadir a alguien dejaba una fila con
        soft-delete que hacía creer que ya no era integrante del proyecto, y
        el backend rechazaba añadirlo a un equipo."""
        project = (
            await client.post(
                "/api/v1/projects/",
                json=valid_project_payload,
                headers=admin_headers,
            )
        ).json()
        user = (
            await client.post(
                "/api/v1/identity/users",
                json={
                    "email": "readd@example.com",
                    "password": "password123",
                    "name": "Rea",
                    "last_name": "Dd",
                    "role": "user",
                    "position": "desarrollador",
                },
                headers=admin_headers,
            )
        ).json()
        payload = {
            "user_id": user["id"],
            "project_id": project["id"],
            "project_role": ProjectRole.INTEGRANTE.value,
        }

        first = await client.post(
            "/api/v1/projects/members/", json=payload, headers=admin_headers
        )
        assert first.status_code == 201
        removal = await client.delete(
            f"/api/v1/projects/members/{first.json()['id']}", headers=admin_headers
        )
        assert removal.status_code == 204

        readd = await client.post(
            "/api/v1/projects/members/", json=payload, headers=admin_headers
        )
        assert readd.status_code == 201, readd.text

        team = (
            await client.post(
                f"/api/v1/projects/{project['id']}/teams",
                json={"name": "Equipo"},
                headers=admin_headers,
            )
        ).json()
        add_to_team = await client.post(
            f"/api/v1/projects/{project['id']}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )
        assert add_to_team.status_code == 201, add_to_team.text

    async def test_should_get_all_members_from_project(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )
        assert project_response.status_code == 201
        project = project_response.json()

        user1_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "ana.gomez@example.com",
                "password": "password123",
                "name": "Ana",
                "last_name": "Gomez",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        user2_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "carlos.perez@example.com",
                "password": "password123",
                "name": "Carlos",
                "last_name": "Perez",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert user1_response.status_code == 201
        assert user2_response.status_code == 201

        user1 = user1_response.json()
        user2 = user2_response.json()

        await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user1["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.INTEGRANTE.value,
            },
            headers=admin_headers,
        )
        await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user2["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.COORDINADOR.value,
            },
            headers=admin_headers,
        )

        members_response = await client.get(
            f"/api/v1/projects/{project['id']}/members",
            headers=admin_headers,
        )

        assert members_response.status_code == 200

        members = members_response.json()

        assert len(members) == 2

        retrieved_names = [m["name"] for m in members]
        retrieved_roles = [m["project_role"] for m in members]

        assert "Ana" in retrieved_names
        assert "Carlos" in retrieved_names
        assert "integrante" in retrieved_roles
        assert "coordinador" in retrieved_roles

    async def test_member_progress_is_weighted_by_structure_depth_and_scoped_per_project(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        """El % de avance de un integrante pesa cada tarea por su nodo en el
        árbol de ESTE proyecto, y no se mezcla con lo que haga en otro proyecto.
        """
        project = (
            await client.post(
                "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
            )
        ).json()
        other_project = (
            await client.post(
                "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
            )
        ).json()

        user = (
            await client.post(
                "/api/v1/identity/users",
                json={
                    "email": "pago@example.com",
                    "password": "password123",
                    "name": "Pago",
                    "last_name": "Test",
                    "role": "user",
                    "position": "desarrollador",
                },
                headers=admin_headers,
            )
        ).json()

        for pid in (project["id"], other_project["id"]):
            resp = await client.post(
                "/api/v1/projects/members/",
                json={
                    "user_id": user["id"],
                    "project_id": pid,
                    "project_role": ProjectRole.INTEGRANTE.value,
                },
                headers=admin_headers,
            )
            assert resp.status_code == 201, resp.text

        tipo = (
            await client.post(
                f"/api/v1/projects/{project['id']}/node-types",
                json={"nombre": "Modulo"},
                headers=admin_headers,
            )
        ).json()

        # Dos módulos raíz (mismo nivel): cada uno pesa 0.5 del proyecto.
        modulo_a = (
            await client.post(
                f"/api/v1/projects/{project['id']}/work-items",
                json={"tipo_id": tipo["id"], "nombre": "Modulo A"},
                headers=admin_headers,
            )
        ).json()
        modulo_b = (
            await client.post(
                f"/api/v1/projects/{project['id']}/work-items",
                json={"tipo_id": tipo["id"], "nombre": "Modulo B"},
                headers=admin_headers,
            )
        ).json()

        task_a = (
            await client.post(
                "/api/v1/tasks",
                json={
                    "title": "Tarea A",
                    "work_item_id": modulo_a["id"],
                    "assignee_id": user["id"],
                },
                headers=admin_headers,
            )
        ).json()
        await client.post(
            "/api/v1/tasks",
            json={
                "title": "Tarea B",
                "work_item_id": modulo_b["id"],
                "assignee_id": user["id"],
            },
            headers=admin_headers,
        )

        # Admin aprueba directo la Tarea A (0.5 del peso del proyecto).
        change = await client.patch(
            f"/api/v1/tasks/{task_a['id']}/status",
            json={"status": "completada"},
            headers=admin_headers,
        )
        assert change.status_code == 200, change.text

        progress = await client.get(
            f"/api/v1/projects/{project['id']}/members/progress",
            headers=admin_headers,
        )
        assert progress.status_code == 200, progress.text
        rows = progress.json()
        assert len(rows) == 1
        row = rows[0]
        assert row["user_id"] == user["id"]
        assert row["tasks_total"] == 2
        assert row["tasks_completed"] == 1
        assert row["progress_pct"] == 50
        # Aún no está en ningún equipo de este proyecto.
        assert row["team_names"] == []

        # Al meterlo en dos equipos, la vista de Integrantes los lista ordenados.
        for team_name in ("Zeta", "Alfa"):
            team = (
                await client.post(
                    f"/api/v1/projects/{project['id']}/teams",
                    json={"name": team_name},
                    headers=admin_headers,
                )
            ).json()
            add = await client.post(
                f"/api/v1/projects/{project['id']}/teams/{team['id']}/members",
                json={"user_id": user["id"]},
                headers=admin_headers,
            )
            assert add.status_code == 201, add.text

        with_teams = (
            await client.get(
                f"/api/v1/projects/{project['id']}/members/progress",
                headers=admin_headers,
            )
        ).json()
        assert with_teams[0]["team_names"] == ["Alfa", "Zeta"]

        # En el otro proyecto (sin tareas para este usuario) el avance es 0,
        # sin arrastrar nada de lo que hizo en el primero.
        other_progress = await client.get(
            f"/api/v1/projects/{other_project['id']}/members/progress",
            headers=admin_headers,
        )
        assert other_progress.status_code == 200, other_progress.text
        other_rows = other_progress.json()
        assert len(other_rows) == 1
        assert other_rows[0]["tasks_total"] == 0
        assert other_rows[0]["progress_pct"] == 0
