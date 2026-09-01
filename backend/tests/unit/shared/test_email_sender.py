"""Adaptadores de correo: elección de proveedor, mapeo de parámetros a Resend y
manejo de errores (traga y registra por defecto; propaga con raise_on_error)."""

import sys
import types

import pytest

from app.shared.email.sender import (
    LoggingEmailSender,
    ResendEmailSender,
    SmtpEmailSender,
    build_email_sender,
)


class _Settings:
    """Settings mínimo para los adaptadores."""

    EMAIL_PROVIDER = "resend"
    RESEND_API_KEY = ""
    EMAIL_FROM = "Bitácora OBJ <no-reply@bitacora.objdigital.com.co>"
    SMTP_HOST = "smtp.example.com"
    SMTP_PORT = 587
    SMTP_USER = ""
    SMTP_PASSWORD = ""
    SMTP_TLS = True


def _fake_resend_module(calls: list):
    mod = types.ModuleType("resend")
    mod.api_key = None
    emails = types.SimpleNamespace()

    def _send(params):
        calls.append(params)
        return {"id": "resend-123"}

    emails.send = _send
    mod.Emails = emails
    return mod


class TestBuildEmailSender:
    def test_picks_resend_when_configured(self):
        s = _Settings()
        s.EMAIL_PROVIDER = "resend"
        s.RESEND_API_KEY = "re_test"
        assert isinstance(build_email_sender(s), ResendEmailSender)

    def test_picks_smtp_only_when_explicitly_selected_and_configured(self):
        s = _Settings()
        s.EMAIL_PROVIDER = "smtp"
        s.SMTP_USER = "u"
        s.SMTP_PASSWORD = "p"
        assert isinstance(build_email_sender(s), SmtpEmailSender)

    def test_degrades_to_log_without_credentials(self):
        s = _Settings()
        s.EMAIL_PROVIDER = "resend"
        s.RESEND_API_KEY = ""
        assert isinstance(build_email_sender(s), LoggingEmailSender)

    def test_unknown_provider_degrades_to_log(self):
        s = _Settings()
        s.EMAIL_PROVIDER = "mailgun"
        assert isinstance(build_email_sender(s), LoggingEmailSender)


class TestResendAdapter:
    async def test_maps_params_and_includes_html(self, monkeypatch):
        calls: list = []
        monkeypatch.setitem(sys.modules, "resend", _fake_resend_module(calls))
        s = _Settings()
        s.RESEND_API_KEY = "re_abc"
        sender = ResendEmailSender(s)

        await sender.send(
            to="dest@example.com",
            subject="Hola",
            body="texto plano",
            html="<p>hola</p>",
        )

        assert len(calls) == 1
        params = calls[0]
        assert params["from"] == s.EMAIL_FROM
        assert params["to"] == ["dest@example.com"]
        assert params["subject"] == "Hola"
        assert params["text"] == "texto plano"
        assert params["html"] == "<p>hola</p>"

    async def test_swallows_provider_error_by_default(self, monkeypatch):
        mod = types.ModuleType("resend")
        mod.api_key = None

        def _boom(_):
            raise RuntimeError("rate limited")

        mod.Emails = types.SimpleNamespace(send=_boom)
        monkeypatch.setitem(sys.modules, "resend", mod)

        s = _Settings()
        s.RESEND_API_KEY = "re_abc"
        sender = ResendEmailSender(s)

        # Sin raise_on_error: no debe propagar (el correo no tumba el flujo).
        await sender.send(to="x@example.com", subject="s", body="b")

        # Con raise_on_error: el endpoint de prueba sí quiere ver el fallo.
        with pytest.raises(RuntimeError, match="rate limited"):
            await sender.send(
                to="x@example.com", subject="s", body="b", raise_on_error=True
            )


class TestLoggingAdapter:
    async def test_never_raises(self):
        await LoggingEmailSender().send(to="x@example.com", subject="s", body="b")
