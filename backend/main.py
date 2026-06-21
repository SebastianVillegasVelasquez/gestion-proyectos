from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logger import get_logger

# ── Import all models to register SQLAlchemy mappers ──────────────────────────
# Important: Import before creating app to ensure all relationships are resolved
from app.core.models_registry import *  # noqa: F401, F403
from app.modules.areas.presentation.routes import router as areas_router
from app.modules.collaborators.presentation.routes import (
    router as collaborators_router,
)
from app.modules.dashboard.presentation.routes import router as dashboard_router
from app.modules.identity.presentation.routes import router as users_router  # noqa: E402
from app.modules.notifications.presentation.routes import (
    router as notifications_router,
)
from app.modules.project.presentation.routes import router as projects_router
from app.modules.project.structure.presentation.routes import router as worktree_router
from app.modules.tasks.presentation.routes import router as tasks_router
from app.modules.teams.presentation.routes import router as teams_router
from app.modules.teams.presentation.workspace_routes import (
    router as workspace_router,
)
from app.modules.traceability.presentation.routes import (
    router as traceability_router,
)
from app.shared.exceptions import (
    ConflictError,
    DomainException,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Iniciando OBJ Digital PM",
        env=get_settings().APP_ENV,
        debug=get_settings().DEBUG,
    )
    from app.core.seed import ensure_super_admin
    from app.core.seed_demo import ensure_demo_data, ensure_demo_traceability

    await ensure_super_admin()
    await ensure_demo_data()
    await ensure_demo_traceability()
    yield
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


@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.message})


@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    logger.error("Excepción de dominio no manejada", error=exc.message)
    return JSONResponse(
        status_code=500, content={"detail": "Error interno del servidor"}
    )


app.include_router(users_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(workspace_router, prefix="/api/v1")
app.include_router(worktree_router, prefix="/api/v1")
app.include_router(collaborators_router, prefix="/api/v1")
app.include_router(traceability_router, prefix="/api/v1")
app.include_router(areas_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
