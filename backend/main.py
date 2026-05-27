"""
Entry point de la aplicación FastAPI.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Import all models to register SQLAlchemy mappers ──────────────────────────
# Important: Import before creating app to ensure all relationships are resolved
from app.core.models_registry import *  # noqa: F401, F403

from app.core.config import get_settings
from app.core.logger import get_logger
from app.shared.exceptions import (
    ConflictError,
    DomainException,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
)

logger = get_logger(__name__)
settings = get_settings()

# ── Lifespan (startup / shutdown) ──────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Iniciando OBJ Digital PM",
        env=settings.APP_ENV,
        debug=settings.DEBUG,
    )
    yield
    logger.info("Cerrando OBJ Digital PM")


# ── App ────────────────────────────────────────────────────────────────────────


app = FastAPI(
    title="OBJ Digital — Sistema de Gestión de Proyectos",
    version="0.1.0",
    docs_url="/docs" if settings.IS_DEV else None,
    redoc_url="/redoc" if settings.IS_DEV else None,
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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


# ── Routers ────────────────────────────────────────────────────────────────────
from app.modules.identity.presentation.routes import router as users_router  # noqa: E402

app.include_router(users_router, prefix="/api/v1")


@app.get("/ping", tags=["health"])
async def ping():
    """Health check — confirma que el API está corriendo."""
    return {"status": "ok", "env": settings.APP_ENV}
