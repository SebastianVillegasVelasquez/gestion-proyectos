import pytest
from _pytest.monkeypatch import MonkeyPatch


@pytest.fixture
def settings(valid_env):
    from app.core.config import get_settings

    get_settings.cache_clear()

    return get_settings()


@pytest.fixture
def valid_env(monkeypatch: MonkeyPatch):
    monkeypatch.setenv("DATABASE_USER", "user")
    monkeypatch.setenv("DATABASE_PASSWORD", "pass")
    monkeypatch.setenv("DATABASE_NAME", "db")
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_PORT", "5432")
