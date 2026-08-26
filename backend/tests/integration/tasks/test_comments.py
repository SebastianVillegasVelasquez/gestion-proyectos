"""Comentarios en tareas, con menciones que notifican.

La conversación vive junto al trabajo: quien llega tarde a una tarea necesita
leer por qué se decidió lo que se decidió, sin ir a buscarlo a un chat aparte.
"""

from tests.integration.worktree.test_routes import _create_project


async def _task(client, admin_headers, valid_project_payload, **extra):
    project_id = await _create_project(client, admin_headers, valid_project_payload)
    created = await client.post(
        "/api/v1/tasks",
        json={"title": "Grabar video 1", "project_id": project_id, **extra},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    return created.json()


class TestComments:
    async def test_publishes_and_lists_in_conversation_order(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)

        for body in ("Primero", "Segundo", "Tercero"):
            posted = await client.post(
                f"/api/v1/tasks/{task['id']}/comments",
                json={"body": body},
                headers=admin_headers,
            )
            assert posted.status_code == 201, posted.text

        listed = await client.get(
            f"/api/v1/tasks/{task['id']}/comments", headers=admin_headers
        )
        # Del más antiguo al más nuevo: una conversación se lee en orden.
        assert [c["body"] for c in listed.json()] == ["Primero", "Segundo", "Tercero"]

    async def test_comment_carries_its_author(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": "Falta el cierre"},
            headers=admin_headers,
        )

        comment = (
            await client.get(
                f"/api/v1/tasks/{task['id']}/comments", headers=admin_headers
            )
        ).json()[0]

        assert comment["author_id"] == str(admin_user.id)
        assert comment["author_name"]

    async def test_rejects_an_empty_comment(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        response = await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": ""},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_rejects_commenting_on_a_task_that_does_not_exist(
        self, client, admin_headers
    ):
        response = await client.post(
            "/api/v1/tasks/00000000-0000-0000-0000-000000000000/comments",
            json={"body": "Hola"},
            headers=admin_headers,
        )
        assert response.status_code == 404

    async def test_a_regular_user_can_comment(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        """Comentar no es cosa de administración: es cómo se pide una
        corrección o se explica una decisión."""
        task = await _task(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": "Ya subí la primera versión"},
            headers=member_headers,
        )

        assert response.status_code == 201, response.text

    async def test_deletes_own_comment_and_it_leaves_the_conversation(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        comment = (
            await client.post(
                f"/api/v1/tasks/{task['id']}/comments",
                json={"body": "Me equivoqué"},
                headers=admin_headers,
            )
        ).json()

        deleted = await client.delete(
            f"/api/v1/comments/{comment['id']}", headers=admin_headers
        )

        assert deleted.status_code == 204
        listed = await client.get(
            f"/api/v1/tasks/{task['id']}/comments", headers=admin_headers
        )
        assert listed.json() == []

    async def test_cannot_delete_someone_elses_comment(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        comment = (
            await client.post(
                f"/api/v1/tasks/{task['id']}/comments",
                json={"body": "Lo de siempre"},
                headers=admin_headers,
            )
        ).json()

        response = await client.delete(
            f"/api/v1/comments/{comment['id']}", headers=member_headers
        )

        assert response.status_code == 403


class TestMentions:
    async def test_mentions_are_stored_with_the_comment(
        self, client, admin_headers, member_user, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)

        posted = await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={
                "body": "Revisa el audio del minuto 3",
                "mentioned_user_ids": [str(member_user.id)],
            },
            headers=admin_headers,
        )

        assert posted.status_code == 201, posted.text
        assert posted.json()["mentioned_user_ids"] == [str(member_user.id)]

    async def test_mentioned_person_gets_notified(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)

        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={
                "body": "Revisa el audio del minuto 3",
                "mentioned_user_ids": [str(member_user.id)],
            },
            headers=admin_headers,
        )

        notifications = await client.get(
            "/api/v1/notifications/", headers=member_headers
        )
        assert notifications.status_code == 200, notifications.text
        kinds = [n["notification_type"] for n in notifications.json()["items"]]
        assert "mencion" in kinds

    async def test_the_same_person_is_not_mentioned_twice(
        self, client, admin_headers, member_user, valid_project_payload
    ):
        """Repetir a alguien en la lista no duplica ni el registro ni el aviso."""
        task = await _task(client, admin_headers, valid_project_payload)

        posted = await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={
                "body": "Ojo con esto",
                "mentioned_user_ids": [str(member_user.id), str(member_user.id)],
            },
            headers=admin_headers,
        )

        assert posted.json()["mentioned_user_ids"] == [str(member_user.id)]

    async def test_nobody_is_notified_of_their_own_comment(
        self, client, admin_headers, admin_user, valid_project_payload
    ):
        """Mencionarte a ti mismo no es una petición a nadie."""
        task = await _task(
            client,
            admin_headers,
            valid_project_payload,
            assignee_id=str(admin_user.id),
        )
        before = (
            await client.get(
                "/api/v1/notifications/unread-count", headers=admin_headers
            )
        ).json()["unread_count"]

        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": "Nota para mí", "mentioned_user_ids": [str(admin_user.id)]},
            headers=admin_headers,
        )

        after = (
            await client.get(
                "/api/v1/notifications/unread-count", headers=admin_headers
            )
        ).json()["unread_count"]
        assert after == before

    async def test_assignee_is_notified_when_someone_comments(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task = await _task(
            client,
            admin_headers,
            valid_project_payload,
            assignee_id=str(member_user.id),
        )

        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": "¿Cómo va esto?"},
            headers=admin_headers,
        )

        notifications = await client.get(
            "/api/v1/notifications/", headers=member_headers
        )
        kinds = [n["notification_type"] for n in notifications.json()["items"]]
        assert "comentario_publicado" in kinds

    async def test_a_mentioned_assignee_gets_one_notification_not_two(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        """La mención gana al aviso genérico: un comentario, un aviso."""
        task = await _task(
            client,
            admin_headers,
            valid_project_payload,
            assignee_id=str(member_user.id),
        )

        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={
                "body": "Esto es para ti",
                "mentioned_user_ids": [str(member_user.id)],
            },
            headers=admin_headers,
        )

        notifications = (
            await client.get("/api/v1/notifications/", headers=member_headers)
        ).json()["items"]
        kinds = [n["notification_type"] for n in notifications]
        assert kinds.count("mencion") == 1
        assert "comentario_publicado" not in kinds
