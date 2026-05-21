class DomainException(Exception):
    """Base para todas las excepciones del dominio."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class NotFoundError(DomainException):
    """Entidad no encontrada."""


class ConflictError(DomainException):
    """Violación de regla de negocio (duplicados, estados inválidos)."""


class ForbiddenError(DomainException):
    """El usuario no tiene permiso para esta acción."""


class ValidationError(DomainException):
    """Validación de dominio fallida (diferente al 422 de Pydantic)."""


class CyclicDependencyError(DomainException):
    """Se detectó un ciclo en dependencias de tareas."""


class InvalidStateTransitionError(DomainException):
    """Transición de estado no permitida."""
