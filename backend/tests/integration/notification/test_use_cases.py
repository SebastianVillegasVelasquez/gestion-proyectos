from sqlalchemy import select

from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus
from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)


class TestNotificationUseCases:
    async def test_notification_should_create_when_task_is_created(
        self,
        client,
        admin_headers,
        valid_project_payload,
        db_session,
    ):
        user = await client.post(
            "/api/v1/identity/",
            json={
                "email": "test@obj.com",
                "password": "secret123",
                "name": "Juan",
                "last_name": "García",
                "role": "user",
                "position": "desarrollador",
            },
        )
        assert user.status_code == 201, user.text
        assignee_id = user.json()["id"]

        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Programa")
        work_item = await _create_item(
            client, admin_headers, project_id, tipo_id, "Item 1"
        )

        task = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "New Task",
                "description": "This is a new task",
                "priority": TaskPriority.MEDIA.value,
                "assignee_id": assignee_id,
                "start_date": "2024-01-01",
                "duration_days": 5,
                "status": TaskStatus.PENDIENTE_POR_INICIAR.value,
                "work_item_id": work_item["id"],
            },
        )
        assert task.status_code == 201, task.text

        result = await db_session.execute(select(Notification))
        notifications = result.scalars().all()

        assert len(notifications) == 1
        notif = notifications[0]
        assert str(notif.user_to_id) == assignee_id
        assert notif.notification_type == NotificationType.TAREA_ASIGNADA
        assert notif.message == "Te asignaron una nueva tarea"
        assert notif.payload == {
            "work_item_id": str(work_item["id"]),
            "task_id": str(task.json()["id"]),
        }
