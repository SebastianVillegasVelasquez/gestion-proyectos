from uuid import UUID

import pytest

from app.modules.identity.application.use_cases import CreateUserUseCase
from app.modules.identity.infrastructure.models import UserRole
from app.modules.identity.presentation.schemas import CreateUserRequest
from app.shared.exceptions import ConflictError


class TestIdentityUseCases:
    async def test_should_raise_exception_when_email_already_exists(
        self,
        build_identity_repository,
        existing_users,
    ):
        use_case = CreateUserUseCase(build_identity_repository(existing_users))

        with pytest.raises(ConflictError, match="El correo ya se encuentra registrado"):
            await use_case.execute(
                CreateUserRequest(
                    email="existing@test.com",
                    password="password1",
                    name="Carlos",
                    last_name="López",
                    role=UserRole.COLLABORATOR,
                )
            )

    async def test_should_create_user(self, build_identity_repository):
        use_case = CreateUserUseCase(build_identity_repository())
        response = await use_case.execute(
            CreateUserRequest(
                email="existing@test.com",
                password="password1",
                name="Carlos",
                last_name="López",
                role=UserRole.COLLABORATOR,
            )
        )
        assert response.id is not None
        assert isinstance(response.id, UUID)
        assert not hasattr(response, "password")
        assert response.role == UserRole.COLLABORATOR
