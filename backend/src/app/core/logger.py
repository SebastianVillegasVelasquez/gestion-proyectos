"""
Logger centralizado del proyecto.

Uso en cualquier archivo:
    from app.core.logger import get_logger
    logger = get_logger(__name__)

    logger.info("Proyecto creado", project_id=str(project.id))
    logger.warning("Tarea vencida", task_id=str(task.id), delay_days=3)
    logger.error("Fallo al enviar email", exc_info=True)

En desarrollo: logs en consola con colores, nivel DEBUG.
En producción: logs en JSON (para centralizar en un futuro con Datadog/Loki).
"""

import logging
import sys
from typing import Any

from app.core.config import get_settings

settings = get_settings()
# ── Formateadores ──────────────────────────────────────────────────────────────


class DevFormatter(logging.Formatter):
    """Formato legible con colores para desarrollo."""

    GREY = "\x1b[38;20m"
    CYAN = "\x1b[36;20m"
    YELLOW = "\x1b[33;20m"
    RED = "\x1b[31;20m"
    BOLD_RED = "\x1b[31;1m"
    RESET = "\x1b[0m"

    COLORS = {
        logging.DEBUG: GREY,
        logging.INFO: CYAN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: BOLD_RED,
    }

    FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, self.GREY)
        formatter = logging.Formatter(
            f"{color}{self.FORMAT}{self.RESET}",
            datefmt="%H:%M:%S",
        )
        # Agrega campos extras (kwargs pasados como extra={})
        if hasattr(record, "extra_fields"):
            record.message = record.getMessage()
            extras = " | " + " ".join(
                f"{k}={v}" for k, v in record.extra_fields.items()
            )
            record.msg = record.msg + extras
        return formatter.format(record)


class ProdFormatter(logging.Formatter):
    """Formato JSON para producción (fácil de parsear por herramientas)."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import datetime, timezone

        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)
        return json.dumps(log_entry, ensure_ascii=False)


# ── Logger con soporte de campos estructurados ─────────────────────────────────


class StructuredLogger(logging.Logger):
    """Logger que acepta kwargs adicionales como campos estructurados.

    Ejemplo:
        logger.info("Usuario autenticado", user_id="abc", role="admin")
    """

    def _log_with_fields(
        self,
        level: int,
        msg: str,
        args: tuple,
        **kwargs: Any,
    ) -> None:
        # Separa exc_info y stack_info de los campos de negocio
        exc_info = kwargs.pop("exc_info", False)
        stack_info = kwargs.pop("stack_info", False)
        stacklevel = kwargs.pop("stacklevel", 1)

        extra = {"extra_fields": kwargs} if kwargs else {}
        super()._log(
            level,
            msg,
            args,
            exc_info=exc_info,
            stack_info=stack_info,
            stacklevel=stacklevel + 1,
            extra=extra,
        )

    def debug(self, msg: str, *args, **kwargs) -> None:  # type: ignore[override]
        if self.isEnabledFor(logging.DEBUG):
            self._log_with_fields(logging.DEBUG, msg, args, **kwargs)

    def info(self, msg: str, *args, **kwargs) -> None:  # type: ignore[override]
        if self.isEnabledFor(logging.INFO):
            self._log_with_fields(logging.INFO, msg, args, **kwargs)

    def warning(self, msg: str, *args, **kwargs) -> None:  # type: ignore[override]
        if self.isEnabledFor(logging.WARNING):
            self._log_with_fields(logging.WARNING, msg, args, **kwargs)

    def error(self, msg: str, *args, **kwargs) -> None:  # type: ignore[override]
        if self.isEnabledFor(logging.ERROR):
            self._log_with_fields(logging.ERROR, msg, args, **kwargs)

    def critical(self, msg: str, *args, **kwargs) -> None:  # type: ignore[override]
        if self.isEnabledFor(logging.CRITICAL):
            self._log_with_fields(logging.CRITICAL, msg, args, **kwargs)


# ── Setup ──────────────────────────────────────────────────────────────────────


logging.setLoggerClass(StructuredLogger)

_configured = False


def _setup_logging() -> None:
    global _configured
    if _configured:
        return

    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if settings.IS_DEV:
        handler.setFormatter(DevFormatter())
    else:
        handler.setFormatter(ProdFormatter())

    # Logger raíz — captura todo
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Silencia librerías muy verbosas
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.IS_DEV else logging.WARNING
    )
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    _configured = True


def get_logger(name: str) -> StructuredLogger:
    """Obtiene un logger configurado para el módulo dado.

    Siempre usa __name__ como argumento:
        logger = get_logger(__name__)
    """
    _setup_logging()
    return logging.getLogger(name)  # type: ignore[return-value]
