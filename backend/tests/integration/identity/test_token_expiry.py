"""Contrato HTTP de la autenticación: 401 cuando la sesión no sirve.

El cliente distingue dos cosas por el código de estado y no puede distinguirlas
de otra forma:

- **401** → «tu sesión no vale»: el interceptor renueva el token con el refresh
  token y reintenta, o cierra sesión. Es recuperable.
- **403** → «estás identificado, pero esto no te corresponde»: reintentar no
  cambia nada, así que el cliente NO debe tocar la sesión.

Devolver 403 o 404 ante un token vencido deja al frontend sin señal: no renueva,
no cierra sesión, y la pantalla se queda sin datos hasta que la persona recarga.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import jwt

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token

ME = "/api/v1/identity/me"


def _token(sub: str, *, minutes: int, kind: str = "access") -> str:
    """Token firmado de verdad, con la expiración que haga falta (incluso pasada)."""
    settings = get_settings()
    return jwt.encode(
        {
            "sub": sub,
            "role": "user",
            "type": kind,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestAuthenticationFailuresAre401:
    async def test_expired_access_token(self, client, created_user):
        resp = await client.get(
            ME, headers=_auth(_token(str(created_user.id), minutes=-1))
        )
        assert resp.status_code == 401, resp.text

    async def test_malformed_token(self, client):
        resp = await client.get(ME, headers=_auth("no-es-un-jwt"))
        assert resp.status_code == 401, resp.text

    async def test_token_signed_with_another_key(self, client, created_user):
        otro = jwt.encode(
            {
                "sub": str(created_user.id),
                "type": "access",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
            },
            "otra-clave-que-no-es-la-nuestra",
            algorithm=get_settings().ALGORITHM,
        )
        resp = await client.get(ME, headers=_auth(otro))
        assert resp.status_code == 401, resp.text

    async def test_refresh_token_used_as_access_token(self, client, created_user):
        resp = await client.get(
            ME, headers=_auth(create_refresh_token(created_user.id))
        )
        assert resp.status_code == 401, resp.text

    async def test_token_without_subject(self, client):
        resp = await client.get(ME, headers=_auth(_token("no-es-un-uuid", minutes=60)))
        assert resp.status_code == 401, resp.text

    async def test_valid_token_of_a_user_that_no_longer_exists(self, client):
        resp = await client.get(ME, headers=_auth(_token(str(uuid4()), minutes=60)))
        assert resp.status_code == 401, resp.text

    async def test_valid_token_of_a_deactivated_user(
        self, client, db_session, created_user
    ):
        token = create_access_token(
            user_id=created_user.id, role=created_user.role.value
        )
        created_user.is_active = False
        await db_session.commit()

        resp = await client.get(ME, headers=_auth(token))
        assert resp.status_code == 401, resp.text

    async def test_message_does_not_say_the_user_was_not_found(self, client):
        """«Usuario no encontrado» llegaba literal a la pantalla de la persona."""
        resp = await client.get(ME, headers=_auth(_token(str(uuid4()), minutes=60)))
        assert "no encontrado" not in resp.json()["detail"].lower()

    async def test_no_token_at_all(self, client):
        resp = await client.get(ME)
        assert resp.status_code == 401, resp.text


class TestAuthorizationFailuresStay403:
    """Contrapeso del cambio: un rol insuficiente NO debe volverse 401, o el
    frontend empezaría a renovar el token y a cerrar sesión en bucle ante una
    pantalla que simplemente no le corresponde."""

    async def test_valid_session_without_the_required_role(
        self, client, member_headers
    ):
        resp = await client.get("/api/v1/identity/users/manage", headers=member_headers)
        assert resp.status_code == 403, resp.text
