# pytest 9 ya no permite `pytest_plugins` fuera del conftest de la raíz. En su
# lugar importamos las fixtures aquí (quedan acotadas a tests/unit/, sin tocar
# las de integración).
from app.core.models_registry import *  # noqa: F401, F403
from tests.fixtures.unit.config import *  # noqa: F401, F403
from tests.fixtures.unit.identity import *  # noqa: F401, F403
from tests.fixtures.unit.project import *  # noqa: F401, F403
from tests.fixtures.unit.dashboard import *  # noqa: F401, F403
from tests.fixtures.unit.collaborators import *  # noqa: F401, F403
from tests.fixtures.unit.traceability import *  # noqa: F401, F403
from tests.fixtures.unit.areas import *  # noqa: F401, F403
from tests.fixtures.shared.fake_repositories import *  # noqa: F401, F403
