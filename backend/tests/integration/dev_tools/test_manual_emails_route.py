"""POST /api/v1/dev/emails — disparo manual de plantillas reales por el developer.

El adaptador real se sustituye por un espía (no se toca la red). Se comprueba el
guardado de rol, el contrato y que `welcome` usa la plantilla real de bienvenida.
"""

import pytest

from app.shared.email.sender import LoggingEmailSender

BASE = "/api/v1/dev/emails"


class _SpySender(LoggingEmailSender):
    provider_name = "spy"

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def _deliver(self, *, to, subject, body, html):
        self.sent.append({"to": to, "subject": subject, "html": html})


@pytest.fixture
def spy_sender(monkeypatch):
    spy = _SpySender()
    monkeypatch.setattr(
        "app.modules.dev_tools.presentation.routes.build_email_sender",
        lambda _settings: spy,
    )
    return spy


async def _make_user(client, admin_headers, email: str) -> str:
    r = await client.post(
        "/api/v1/identity/users",
        json={
            "email": email,
            "password": "password123",
            "name": "Rita",
            "last_name": "Cuello",
            "role": "user",
            "position": "desarrollador",
        },
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestDevManualEmailsRoute:
    async def test_forbidden_for_non_developer(self, client, admin_headers):
        r = await client.post(
            BASE,
            json={
                "kind": "welcome",
                "recipient_ids": ["00000000-0000-0000-0000-000000000000"],
            },
            headers=admin_headers,
        )
        assert r.status_code == 403

    async def test_requires_at_least_one_recipient(self, client, developer_headers):
        r = await client.post(
            BASE,
            json={"kind": "welcome", "recipient_ids": []},
            headers=developer_headers,
        )
        assert r.status_code == 422

    async def test_welcome_sends_real_template(
        self, client, developer_headers, admin_headers, spy_sender
    ):
        user_id = await _make_user(client, admin_headers, "welcome-manual@example.com")

        r = await client.post(
            BASE,
            json={"kind": "welcome", "recipient_ids": [user_id]},
            headers=developer_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_sent"] == 1
        assert body["results"][0]["user_id"] == user_id
        assert body["results"][0]["sent"] == 1
        assert len(spy_sender.sent) == 1
        assert spy_sender.sent[0]["subject"] == "Te damos la bienvenida a Bitácora OBJ"

    async def test_unknown_recipient_is_reported_not_fatal(
        self, client, developer_headers, spy_sender
    ):
        r = await client.post(
            BASE,
            json={
                "kind": "welcome",
                "recipient_ids": ["11111111-1111-1111-1111-111111111111"],
            },
            headers=developer_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_sent"] == 0
        assert body["results"][0]["detail"] == "Usuario no encontrado"

    async def test_overdue_with_no_tasks_reports_clean(
        self, client, developer_headers, admin_headers, spy_sender
    ):
        user_id = await _make_user(client, admin_headers, "overdue-manual@example.com")

        r = await client.post(
            BASE,
            json={"kind": "overdue", "recipient_ids": [user_id]},
            headers=developer_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_sent"] == 0
        assert body["results"][0]["detail"] == "Sin tareas vencidas"
        assert spy_sender.sent == []
