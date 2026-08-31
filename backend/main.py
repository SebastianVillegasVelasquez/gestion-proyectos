from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger

# ── Import all models to register SQLAlchemy mappers ──────────────────────────
# Important: Import before creating app to ensure all relationships are resolved
from app.core.models_registry import *  # noqa: F401, F403
from app.modules.collaborators.presentation.routes import (
    router as collaborators_router,
)
from app.modules.dashboard.presentation.public_routes import (
    router as public_router,
)
from app.modules.dashboard.presentation.routes import router as dashboard_router
from app.modules.feedback.presentation.routes import router as feedback_router
from app.modules.identity.presentation.routes import router as users_router  # noqa: E402
from app.modules.notifications.presentation.routes import (
    router as notifications_router,
)
from app.modules.notifications.presentation.websocket import router as ws_router
from app.modules.reminders.presentation.routes import router as reminders_router
from app.modules.project.presentation.routes import router as projects_router
from app.modules.project.structure.presentation.routes import router as worktree_router
from app.modules.tasks.presentation.routes import router as tasks_router
from app.modules.teams.presentation.routes import router as teams_router
from app.modules.teams.presentation.workspace_routes import (
    router as workspace_router,
)
from app.modules.teams.presentation.personal_routes import (
    router as personal_deliverables_router,
)
from app.modules.traceability.presentation.routes import (
    router as traceability_router,
)
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.broadcasting.memory import InMemoryBroadcaster
from app.shared.broadcasting.redis import RedisBroadcaster
from app.shared.connection_manager import ConnectionManager
from app.shared.exceptions import (
    ConflictError,
    CyclicDependencyError,
    DomainException,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
)
from app.shared.rate_limit import TooManyRequestsError

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    logger.info("Iniciando OBJ Digital PM", env=settings.APP_ENV, debug=settings.DEBUG)
    logger.info(f"Connecting to REDIS: {settings.REDIS_URL}")
    logger.info("Testing hot reload")

    if not settings.IS_DEV and len(settings.SECRET_KEY) < 32:
        logger.warning("SECRET_KEY débil o ausente en un entorno no-dev: ...")

    # Antes que nada: si la base se quedó atrás en migraciones, decirlo aquí y
    # con claridad. Si no, se descubre pantalla por pantalla en forma de 500.
    from app.core.database import AsyncSessionLocal
    from app.core.schema_check import warn_if_schema_is_behind

    engine = AsyncSessionLocal.kw["bind"]
    await warn_if_schema_is_behind(engine)

    from app.core.seeding import run_seed

    await run_seed()

    broadcaster: Broadcaster = (
        RedisBroadcaster(url=settings.REDIS_URL)
        if settings.USE_REDIS_AS_BROADCASTER
        else InMemoryBroadcaster()
    )

    await broadcaster.connect()
    logger.debug(f"Conectado al broadcaster {broadcaster.__class__.__name__}")
    app.state.broadcaster = broadcaster
    app.state.manager = ConnectionManager(broadcaster=broadcaster)

    # ── Bucles de avisos por tiempo (tareas atrasadas + recordatorios) ──
    from app.core.overdue_worker import start_overdue_worker

    background_tasks = start_overdue_worker(settings)

    yield

    # ── Shutdown en orden inverso ──
    for task in background_tasks:
        task.cancel()
    await app.state.manager.shutdown()
    await app.state.broadcaster.disconnect()

    logger.info("Cerrando OBJ Digital PM")


# ── App ────────────────────────────────────────────────────────────────────────


app = FastAPI(
    title="OBJ Digital — Sistema de Gestión de Proyectos",
    version="0.1.0",
    docs_url="/docs" if get_settings().IS_DEV else None,
    redoc_url="/redoc" if get_settings().IS_DEV else None,
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Exception handlers ─────────────────────────────────────────────────────────
# Convierten excepciones de dominio en respuestas HTTP apropiadas.
# Así los use cases pueden lanzar NotFoundError sin saber nada de HTTP.


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": exc.message})


@app.exception_handler(CyclicDependencyError)
async def cyclic_dependency_handler(request: Request, exc: CyclicDependencyError):
    return JSONResponse(status_code=409, content={"detail": exc.message})


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.message})


@app.exception_handler(TooManyRequestsError)
async def too_many_requests_handler(request: Request, exc: TooManyRequestsError):
    return JSONResponse(status_code=429, content={"detail": exc.message})


@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    logger.error("Excepción de dominio no manejada", error=exc.message)
    return JSONResponse(
        status_code=500, content={"detail": "Error interno del servidor"}
    )


@app.get("/health", tags=["Health"])
async def health():
    """Healthcheck para orquestadores/balanceadores: verifica la BD."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:  # noqa: BLE001 - cualquier fallo de BD => degradado
        return JSONResponse(
            status_code=503, content={"status": "degraded", "database": "error"}
        )


app.include_router(worktree_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(public_router, prefix="/api/v1")
# El router del workspace va ANTES que el de teams: su ruta literal /teams/mine
# debe resolverse antes que /teams/{team_id} (que tomaría "mine" como UUID -> 422).
app.include_router(workspace_router, prefix="/api/v1")
app.include_router(personal_deliverables_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(collaborators_router, prefix="/api/v1")
app.include_router(traceability_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(reminders_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")
