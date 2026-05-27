from app.core.models_registry import *  # noqa: F401, F403


pytest_plugins = [
    "tests.fixtures.config",
    "tests.fixtures.identity",
    "tests.fixtures.database",
]
