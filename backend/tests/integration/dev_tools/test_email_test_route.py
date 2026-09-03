"""POST /api/v1/dev/email-test — herramienta del developer y del super_admin
para probar el envío de correo en producción.

El adaptador real se sustituye por un espía (no se toca la red): lo que se
prueba aquí es el guardado de rol, el rate limit y el contrato de la respuesta.
"""

import pytest

from app.shared.email.sender import LoggingEmailSender

BASE = "/api/v1/dev/email-test"


class _SpySender(LoggingEmailSender):
    provider_name = "spy"

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def _deliver(self, *, to, subject, body, html):
        self.sent.append({"to": to, "subject": subject, "body": body, "html": html})


@pytest.fixture
def spy_sender(monkeypatch):
    spy = _SpySender()
    monkeypatch.setattr(
        "app.modules.dev_tools.presentation.routes.build_email_sender",
        lambda _settings: spy,
    )
    return spy


@pytest.fixture(autouse=True)
def _no_logo_network(monkeypatch):
    """El chequeo de alcance del logo hace un GET real: se anula en tests."""

    async def _fake(logo_url):
        return (bool(logo_url), f"HTTP 200 · content-type: image/jpeg ({logo_url})")

    monkeypatch.setattr(
        "app.modules.dev_tools.presentation.routes._check_logo_reachable", _fake
    )


class TestDevEmailTestRoute:
    async def test_requires_authentication(self, client):
        r = await client.post(BASE, json={"to": "x@example.com"})
        assert r.status_code == 401

    async def test_forbidden_for_admin(self, client, admin_headers):
        # La consola manda correos reales desde nuestro dominio: la puerta se
        # queda en el rol técnico y la administración máxima.
        r = await client.post(BASE, json={"to": "x@example.com"}, headers=admin_headers)
        assert r.status_code == 403

    async def test_super_admin_is_allowed(
        self, client, super_admin_headers, spy_sender
    ):
        r = await client.post(
            BASE, json={"to": "x@example.com"}, headers=super_admin_headers
        )
        assert r.status_code == 200

    async def test_rejects_invalid_email(self, client, developer_headers):
        r = await client.post(
            BASE, json={"to": "not-an-email"}, headers=developer_headers
        )
        assert r.status_code == 422

    async def test_developer_sends_with_defaults(
        self, client, developer_headers, spy_sender
    ):
        r = await client.post(
            BASE, json={"to": "dest@example.com"}, headers=developer_headers
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["sent"] is True
        assert body["provider"] == "spy"
        assert body["to"] == "dest@example.com"
        # Diagnóstico: las URLs que el servidor resolvió de APP_PUBLIC_URL.
        assert body["resolved_login_url"].endswith("/login")
        assert body["resolved_logo_url"].endswith("/logo-email.jpg")
        assert body["logo_reachable"] is True
        assert len(spy_sender.sent) == 1
        assert spy_sender.sent[0]["to"] == "dest@example.com"

        # Sin overrides: se manda la plantilla REAL de bienvenida, con logo —
        # la prueba valida exactamente lo que le llega a cualquier usuario.
        assert spy_sender.sent[0]["subject"] == "Te damos la bienvenida a Bitácora OBJ"
        html = spy_sender.sent[0]["html"]
        assert "logo-email.jpg" in html
        assert "Bit&aacute;cora OBJ" in html

    async def test_custom_subject_and_body(self, client, developer_headers, spy_sender):
        r = await client.post(
            BASE,
            json={
                "to": "dest@example.com",
                "subject": "Asunto propio",
                "html_body": "<p>cuerpo propio</p>",
            },
            headers=developer_headers,
        )
        assert r.status_code == 200, r.text
        assert spy_sender.sent[0]["subject"] == "Asunto propio"
        assert spy_sender.sent[0]["html"] == "<p>cuerpo propio</p>"

    async def test_provider_failure_returns_502(
        self, client, developer_headers, monkeypatch
    ):
        class _Boom(LoggingEmailSender):
            provider_name = "boom"

            async def _deliver(self, *, to, subject, body, html):
                raise RuntimeError("rate limit")

        monkeypatch.setattr(
            "app.modules.dev_tools.presentation.routes.build_email_sender",
            lambda _s: _Boom(),
        )
        r = await client.post(
            BASE, json={"to": "dest@example.com"}, headers=developer_headers
        )
        assert r.status_code == 502
        assert "rate limit" in r.json()["detail"]

    async def test_rate_limited_after_five_per_minute(
        self, client, developer_headers, spy_sender
    ):
        for i in range(5):
            ok = await client.post(
                BASE, json={"to": f"d{i}@example.com"}, headers=developer_headers
            )
            assert ok.status_code == 200, ok.text
        blocked = await client.post(
            BASE, json={"to": "d6@example.com"}, headers=developer_headers
        )
        assert blocked.status_code == 429
