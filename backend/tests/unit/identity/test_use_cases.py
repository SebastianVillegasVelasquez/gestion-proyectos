from uuid import UUID

import pytest

from app.modules.identity.application.use_cases import CreateUserUseCase
from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.presentation.schemas import CreateUserRequest
from app.shared.exceptions import ConflictError, NotFoundError


class TestIdentityUseCases:
    async def test_should_raise_exception_when_email_already_exists(
        self,
        build_identity_repository,
        build_position_repository,
        existing_users,
    ):
        use_case = CreateUserUseCase(
            build_identity_repository(existing_users), build_position_repository()
        )

        with pytest.raises(ConflictError, match="El correo ya se encuentra registrado"):
            await use_case.execute(
                CreateUserRequest(
                    email="existing@test.com",
                    password="password1",
                    name="Carlos",
                    last_name="López",
                    role=SystemRole.USER,
                )
            )

    async def test_should_raise_exception_when_position_does_not_exist(
        self,
        build_identity_repository,
        build_position_repository,
    ):
        use_case = CreateUserUseCase(
            build_identity_repository(users=[]), build_position_repository()
        )

        with pytest.raises(NotFoundError, match="cargo_inexistente"):
            await use_case.execute(
                CreateUserRequest(
                    email="nuevo@test.com",
                    password="password1",
                    name="Carlos",
                    last_name="López",
                    role=SystemRole.USER,
                    position="cargo_inexistente",
                )
            )

    @pytest.mark.skip(reason="Problemas de importacion con modelos ORM")
    async def test_should_create_user(
        self, build_identity_repository, build_position_repository
    ):
        use_case = CreateUserUseCase(
            build_identity_repository(users=[]), build_position_repository()
        )
        response = await use_case.execute(
            CreateUserRequest(
                email="existing@test.com",
                password="password1",
                name="Carlos",
                last_name="López",
                role=SystemRole.USER,
            )
        )
        assert response.id is not None
        assert isinstance(response.id, UUID)
        assert not hasattr(response, "password")
        assert response.role == SystemRole.USER
