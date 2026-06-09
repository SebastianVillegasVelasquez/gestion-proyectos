from app.core.models_registry import *  # noqa: F401, F403

pytest_plugins = [
    "tests.fixtures.unit.config",
    "tests.fixtures.unit.identity",
    "tests.fixtures.unit.project",
    "tests.fixtures.global.fake_repositories",
]
