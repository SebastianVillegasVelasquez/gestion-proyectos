# pytest 9 ya no permite `pytest_plugins` fuera del conftest de la raíz. Importamos
# las fixtures aquí; quedan acotadas a tests/integration/ (la BD de test solo se
# levanta para estos tests, no para los unitarios).
from app.core.models_registry import *  # noqa: F401, F403
from tests.fixtures.integration.database import *  # noqa: F401, F403
from tests.fixtures.integration.security import *  # noqa: F401, F403
from tests.fixtures.integration.identity import *  # noqa: F401, F403
from tests.fixtures.unit.project import *  # noqa: F401, F403
