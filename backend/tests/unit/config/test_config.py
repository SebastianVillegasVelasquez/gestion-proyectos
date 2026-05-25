import pytest

from app.core.config import Settings


class TestConfig:
    @pytest.mark.config
    def test_url_construct(self, valid_env, settings: Settings):
        # Configuración de variables de entorno para la prueba
        # valid_env sets: test_user, test_pass, test_db
        expected_url = "postgresql+asyncpg://test_user:test_pass@localhost:5432/test_db"

        assert settings.DATABASE_URL == expected_url

    @pytest.mark.config
    def test_model_dump_json_includes_properties(self, settings: Settings):
        assert "DATABASE_URL" in settings.model_dump()

    @pytest.mark.config
    def test_is_dev(self, settings: Settings):
        assert settings.IS_DEV is True

    @pytest.mark.config
    def test_settings_cached(self, settings):
        from app.core.config import get_settings

        settings2 = get_settings()

        assert settings is settings2

    @pytest.mark.config
    def test_cache_clear_creates_new_instance(self, settings):
        from app.core.config import get_settings

        old = settings

        get_settings.cache_clear()

        new = get_settings()

        assert old is not new
