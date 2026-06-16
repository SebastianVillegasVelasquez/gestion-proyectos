# Importa todos los modelos para que SQLAlchemy resuelva las relaciones
# (User → Task/ProjectMember) sin depender del orden de import.
import app.core.models_registry  # noqa: F401
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.identity.infrastructure.repository import UserRepository

logger = get_logger(__name__)


async def ensure_super_admin() -> None:
    """Crea un super admin al iniciar si aún no existe (idempotente).

    Se valida por email: si ya hay un usuario con ese correo, no se hace nada.
    No interrumpe el arranque si la BD no está lista; solo deja un log.
    """
    settings = get_settings()

    # Sin contraseña configurada no creamos un admin (evita credenciales débiles
    # o un admin sin clave usable). Debe definirse SUPERADMIN_PASSWORD en el .env.
    if not settings.SUPERADMIN_PASSWORD:
        logger.warning(
            "SUPERADMIN_PASSWORD no está configurada; se omite el seed del super admin"
        )
        return

    try:
        async with AsyncSessionLocal() as session:
            repo = UserRepository(session)
            if await repo.get_by_email(settings.SUPERADMIN_EMAIL) is not None:
                logger.info("Super admin ya existe; no se recrea")
                return

            session.add(
                User(
                    email=settings.SUPERADMIN_EMAIL,
                    password=hash_password(settings.SUPERADMIN_PASSWORD),
                    name=settings.SUPERADMIN_NAME,
                    last_name=settings.SUPERADMIN_LAST_NAME,
                    role=SystemRole.SUPER_ADMIN,
                    position=UserPosition.SIN_CARGO,
                    is_active=True,
                )
            )
            await session.commit()
            logger.info("Super admin creado", email=settings.SUPERADMIN_EMAIL)
    except Exception as exc:  # noqa: BLE001 - el arranque no debe fallar por el seed
        logger.warning("No se pudo sembrar el super admin", error=str(exc))
