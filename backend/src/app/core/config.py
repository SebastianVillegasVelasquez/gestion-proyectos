import os
from functools import lru_cache
from typing import Literal

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env") if not os.getenv("TESTING") else None,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    # ── App ─────────────────────────────────────
    APP_ENV: Literal["development", "production"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Database ────────────────────────────────
    DATABASE_HOST: str = ""
    DATABASE_PORT: int = 0
    DATABASE_NAME: str = ""
    DATABASE_USER: str = ""
    DATABASE_PASSWORD: str = ""

    # ── Security ────────────────────────────────
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Super admin sembrado al iniciar ─────────
    SUPERADMIN_EMAIL: str = "superadmin@objdigital.com"
    SUPERADMIN_PASSWORD: str = ""
    SUPERADMIN_NAME: str = "Super"
    SUPERADMIN_LAST_NAME: str = "Admin"

    # ── Developer sembrado al iniciar (rol técnico: todo + bandeja de feedback) ─
    DEVELOPER_EMAIL: str = "developer@objdigital.com"
    DEVELOPER_PASSWORD: str = ""
    DEVELOPER_NAME: str = "Dev"
    DEVELOPER_LAST_NAME: str = "OBJ"

    # ── Usuarios de OBJ Digital sembrados al iniciar SOLO en producción ─────────
    ANA_EMAIL: str = "ana@objdigital.com"
    ANA_PASSWORD: str = ""
    JORGE_EMAIL: str = "jorge@objdigital.com"
    JORGE_PASSWORD: str = ""
    JHON_EMAIL: str = "jhon@objdigital.com"
    JHON_PASSWORD: str = ""
    SEBASTIAN_EMAIL: str = "sebastian@objdigital.com"
    SEBASTIAN_PASSWORD: str = ""

    # ── Email ───────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "OBJ Digital <no-reply@objdigital.com>"
    # URL pública del frontend: se usa para construir los enlaces "abrir tarea",
    # "revisar entrega", etc. dentro de los correos. Sin barra final.
    APP_PUBLIC_URL: str = "http://localhost:5173"

    # Barrido periódico de tareas atrasadas (notificación + correo de aviso).
    OVERDUE_SCAN_ENABLED: bool = True
    OVERDUE_SCAN_INTERVAL_HOURS: int = 6

    # Despacho de recordatorios personales (notificación y/o correo).
    REMINDERS_SCAN_ENABLED: bool = True
    REMINDERS_SCAN_INTERVAL_MINUTES: int = 5

    # ── OpenAI ──────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MAX_TOKENS: int = 2000

    # ── Redis ──────────────────────────────────
    REDIS_URL: str = ""

    # ── Broadcaster option ──────────────────────────────────
    USE_REDIS_AS_BROADCASTER: bool = False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @computed_field  # type: ignore
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DATABASE_USER}:"
            f"{self.DATABASE_PASSWORD}@"
            f"{self.DATABASE_HOST}:"
            f"{self.DATABASE_PORT}/"
            f"{self.DATABASE_NAME}"
        )

    @computed_field  # type: ignore
    @property
    def IS_DEV(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
