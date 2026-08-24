import pytest

from app.modules.identity.application.use_cases import (
    BulkCreateUsersUseCase,
    _slugify_position_key,
)
from app.modules.identity.infrastructure.enums import SystemRole


class TestBulkCreateUsersUseCase:
    async def test_creates_user_with_spanish_columns(
        self, build_identity_repository, build_position_repository
    ):
        use_case = BulkCreateUsersUseCase(
            build_identity_repository(users=[]), build_position_repository()
        )

        result = await use_case.execute(
            [{"email": "ana@test.com", "nombre": "Ana", "apellido": "Garcia"}],
            actor_role="admin",
        )

        assert result.failed == []
        assert len(result.created) == 1
        assert result.created[0].email == "ana@test.com"

    async def test_missing_required_column_fails_the_row(
        self, build_identity_repository, build_position_repository
    ):
        use_case = BulkCreateUsersUseCase(
            build_identity_repository(users=[]), build_position_repository()
        )

        result = await use_case.execute(
            [{"email": "ana@test.com", "nombre": "Ana"}],  # falta apellido
            actor_role="admin",
        )

        assert result.created == []
        assert len(result.failed) == 1
        assert "apellido" in result.failed[0].error

    async def test_unknown_cargo_is_auto_created_instead_of_failing(
        self, build_identity_repository, build_position_repository
    ):
        position_repo = build_position_repository()
        use_case = BulkCreateUsersUseCase(
            build_identity_repository(users=[]), position_repo
        )

        result = await use_case.execute(
            [
                {
                    "email": "nuevo@test.com",
                    "nombre": "Nuevo",
                    "apellido": "Cargo",
                    "cargo": "Diseñador Gráfico",
                }
            ],
            actor_role="admin",
        )

        assert result.failed == []
        assert len(result.created) == 1
        assert "diseñador_gráfico" in position_repo.existing_keys

    async def test_cedula_is_optional(
        self, build_identity_repository, build_position_repository
    ):
        use_case = BulkCreateUsersUseCase(
            build_identity_repository(users=[]), build_position_repository()
        )

        result = await use_case.execute(
            [{"email": "sincedula@test.com", "nombre": "Sin", "apellido": "Cedula"}],
            actor_role="admin",
        )

        assert result.failed == []
        assert len(result.created) == 1

    async def test_bulk_created_users_are_always_role_user(
        self, build_identity_repository, build_position_repository
    ):
        repo = build_identity_repository(users=[])
        use_case = BulkCreateUsersUseCase(repo, build_position_repository())

        await use_case.execute(
            [{"email": "rol@test.com", "nombre": "Rol", "apellido": "Test"}],
            actor_role="admin",
        )

        assert repo.saved_users[0].role == SystemRole.USER

    async def test_role_column_in_csv_is_ignored(
        self, build_identity_repository, build_position_repository
    ):
        repo = build_identity_repository(users=[])
        use_case = BulkCreateUsersUseCase(repo, build_position_repository())

        result = await use_case.execute(
            [
                {
                    "email": "ignorado@test.com",
                    "nombre": "Ignora",
                    "apellido": "Rol",
                    "role": "super_admin",
                }
            ],
            actor_role="admin",
        )

        assert result.failed == []
        assert repo.saved_users[0].role == SystemRole.USER


class TestSlugifyPositionKey:
    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("Desarrollador", "desarrollador"),
            ("Diseñador Gráfico", "diseñador_gráfico"),
            ("  Project Manager  ", "project_manager"),
            ("", "sin_cargo"),
        ],
    )
    def test_slugify(self, raw, expected):
        assert _slugify_position_key(raw) == expected
