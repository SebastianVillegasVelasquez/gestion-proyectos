import pytest
from _pytest.monkeypatch import MonkeyPatch


@pytest.fixture
def valid_env(monkeypatch: MonkeyPatch):
    """Configura variables de entorno válidas para testing."""
    monkeypatch.setenv("DATABASE_USER", "test_user")
    monkeypatch.setenv("DATABASE_PASSWORD", "test_pass")
    monkeypatch.setenv("DATABASE_NAME", "test_db")
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_PORT", "5432")
    monkeypatch.setenv("SECRET_KEY", "test_secret_key")


@pytest.fixture
def settings(valid_env):
    """Obtiene la configuración con variables de entorno válidas."""
    from app.core.config import get_settings

    get_settings.cache_clear()
    return get_settings()
