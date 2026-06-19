from app.core.models_registry import *  # noqa: F401, F403

pytest_plugins = [
    "tests.fixtures.unit.config",
    "tests.fixtures.unit.identity",
    "tests.fixtures.unit.project",
    "tests.fixtures.unit.dashboard",
    "tests.fixtures.unit.collaborators",
    "tests.fixtures.unit.traceability",
    "tests.fixtures.unit.areas",
    "tests.fixtures.global.fake_repositories",
]
