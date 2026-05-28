from uuid import uuid4

import pytest


async def test_create_user_test_case(client):
    response = await client.post(
        "/api/v1/identity/",
        json={
            "email": "test@obj.com",
            "password": "secret123",
            "name": "Juan",
            "last_name": "García",
            "role": "member",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "test@obj.com"
    assert "password" not in response.json()


async def test_create_user_password_should_have_at_least_8_characters(client):
    result = await client.post(
        "/api/v1/identity/",
        json={
            "email": "test@obj.com",
            "password": "pass",
            "name": "Juan",
            "last_name": "García",
            "role": "member",
        },
    )

    print(result.json())
    assert result.status_code == 422
    assert (
        result.json()["detail"][0]["msg"] == "String should have at least 8 characters"
    )


async def test_create_user_password_should_have_at_least_1_number(client):
    result = await client.post(
        "/api/v1/identity/",
        json={
            "email": "test@obj.com",
            "password": "passworddd",
            "name": "Juan",
            "last_name": "García",
            "role": "member",
        },
    )

    assert result.status_code == 422
    assert (
        result.json()["detail"][0]["msg"]
        == "Value error, La contraseña debe contener al menos un número"
    )


async def test_get_user_by_id_should_return_user(
    client,
    created_user,
    admin_token,
):
    result = await client.get(
        f"/api/v1/identity/users/{created_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 200

    data = result.json()

    assert data["email"] == created_user.email


async def test_get_user_by_id_should_return_404(
    client,
    admin_token,
):
    result = await client.get(  # noqa: F821
        f"/api/v1/identity/users/{uuid4()}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 404


async def test_get_users_should_return_list(
    client,
    admin_token,
):
    result = await client.get(
        "/api/v1/identity/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 200

    assert isinstance(result.json(), list)


@pytest.mark.skip(reason="Not implemented yet")
async def test_patch_user_should_update_name(
    client,
    created_user,
    admin_token,
):
    result = await client.patch(
        f"/api/v1/identity/users/{created_user.id}",
        json={"name": "Carlos"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 200

    data = result.json()

    assert data["name"] == "Carlos"


@pytest.mark.skip(reason="Not implemented yet")
async def test_patch_user_should_fail_if_email_exists(
    client,
    created_user,
    second_user,
    admin_token,
):
    result = await client.patch(
        f"/api/v1/identity/users/{created_user.id}",
        json={"email": second_user.email},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 409

    assert result.json()["detail"] == "El correo ya se encuentra registrado"


async def test_delete_user_should_soft_delete(
    client,
    created_user,
    admin_token,
):
    result = await client.delete(
        f"/api/v1/identity/users/{created_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 200


async def test_delete_user_should_return_404(
    client,
    admin_token,
):
    result = await client.delete(
        f"/api/v1/identity/users/{uuid4()}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert result.status_code == 404


async def test_deleted_user_should_be_inactive(
    db_session,
    client,
    created_user,
    admin_token,
):
    await client.delete(
        f"/api/v1/identity/users/{created_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    await db_session.refresh(created_user)

    assert created_user.is_active is False
