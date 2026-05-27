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
