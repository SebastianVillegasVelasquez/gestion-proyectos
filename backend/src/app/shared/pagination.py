"""Paginación reutilizable (no es lógica de negocio, es de infraestructura).

Encapsula el normalizado de `page`/`page_size` y el cálculo de `offset` para no
repetir esa aritmética en cada endpoint paginado.
"""

from dataclasses import dataclass

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 50


@dataclass(frozen=True)
class Pagination:
    page: int
    page_size: int

    @classmethod
    def of(cls, page: int = 1, page_size: int = DEFAULT_PAGE_SIZE) -> "Pagination":
        """Construye una paginación válida (acota a rangos seguros)."""
        page = max(1, page)
        page_size = min(MAX_PAGE_SIZE, max(1, page_size))
        return cls(page=page, page_size=page_size)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def pagination_params(page: int = 1, page_size: int = DEFAULT_PAGE_SIZE) -> Pagination:
    """Dependency de FastAPI: expone page/page_size como query params y los acota.

    Se reutiliza en cualquier endpoint paginado con `Depends(pagination_params)`.
    """
    return Pagination.of(page=page, page_size=page_size)
