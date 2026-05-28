from app.core.models_registry import *  # noqa: F401, F403

pytest_plugins = [
    "tests.fixtures.integration.database",
    "tests.fixtures.integration.security",
    "tests.fixtures.integration.identity",
]
