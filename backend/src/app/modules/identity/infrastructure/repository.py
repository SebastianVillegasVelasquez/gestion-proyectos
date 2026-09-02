from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.modules.identity.infrastructure.models import (
    Position,
    User,
    UserReleaseView,
)
from app.shared.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=User, session=session)

    async def get_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)

        result = await self._session.execute(query)

        return result.scalars().first()

    async def get_by_activation_token_hash(self, token_hash: str) -> User | None:
        """Usuario cuyo token de activación (SHA-256) coincide, o None. La
        caducidad y el consumo del token los valida el caso de uso."""
        result = await self._session.execute(
            select(User).where(User.activation_token_hash == token_hash)
        )
        return result.scalars().first()

    async def get_by_document_number(self, document_number: str) -> User | None:
        query = select(User).where(User.document_number == document_number)
        result = await self._session.execute(query)
        return result.scalars().first()

    async def is_document_available(
        self, document_number: str, exclude_id: UUID | None = None
    ) -> bool:
        """True si el documento no lo tiene otro usuario (permite reusar el propio)."""
        user = await self.get_by_document_number(document_number)
        if user is None:
            return True
        return exclude_id is not None and user.id == exclude_id

    async def search_directory(
        self,
        search: str | None,
        position: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        """Búsqueda paginada de usuarios activos por nombre/apellido/correo y cargo.

        Devuelve (página de usuarios, total que cumple el filtro) para no traer
        toda la tabla al cliente.
        """
        conditions: list[ColumnElement[bool]] = [
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        ]
        if position is not None:
            conditions.append(User.position == position)
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                    User.document_number.ilike(like),
                )
            )

        total = await self._session.scalar(
            select(func.count()).select_from(User).where(*conditions)
        )
        rows = (
            (
                await self._session.execute(
                    select(User)
                    .where(*conditions)
                    .order_by(User.name, User.last_name)
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)

    # Columnas por las que la tabla de administración deja ordenar. El mapa
    # existe para no interpolar nunca texto del cliente en el ORDER BY: lo que
    # no esté aquí se ignora y cae en el orden por defecto.
    ADMIN_SORT_COLUMNS: dict[str, list[InstrumentedAttribute]] = {
        "name": [User.name, User.last_name],
        "email": [User.email],
        "role": [User.role],
        "position": [User.position],
        "status": [User.is_active],
        "created_at": [User.created_at],
    }

    async def search_users_admin(
        self,
        search: str | None,
        limit: int,
        offset: int,
        include_inactive: bool = True,
        sort_by: str = "name",
        sort_dir: str = "asc",
    ) -> tuple[list[User], int]:
        """Búsqueda paginada para administración: puede INCLUIR inactivos (para
        poder reactivarlos), excluye solo los borrados. Filtra por
        nombre/apellido/correo/documento y ordena por la columna pedida.

        El orden se resuelve en la base de datos (no en el cliente) porque la
        lista viene paginada: ordenar solo la página visible daría un orden
        falso respecto del total.
        """
        conditions: list[ColumnElement[bool]] = [User.deleted_at.is_(None)]
        if not include_inactive:
            conditions.append(User.is_active.is_(True))
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                    User.document_number.ilike(like),
                )
            )

        columns = (
            self.ADMIN_SORT_COLUMNS.get(sort_by) or self.ADMIN_SORT_COLUMNS["name"]
        )
        descending = sort_dir == "desc"
        order_by = [c.desc() if descending else c.asc() for c in columns]
        # Desempate estable: sin él, dos filas iguales en la columna elegida
        # pueden bailar entre páginas.
        order_by.append(User.id.asc())

        total = await self._session.scalar(
            select(func.count()).select_from(User).where(*conditions)
        )
        rows = (
            (
                await self._session.execute(
                    select(User)
                    .where(*conditions)
                    .order_by(*order_by)
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)

    async def is_email_available(
        self, email: str, exclude_id: UUID | None = None
    ) -> bool:
        user = await self.get_by_email(email)
        if user is None:
            return True
        return exclude_id is not None and user.id == exclude_id

    # ── Novedades vistas por el usuario (modal "what's new") ──────────────────
    async def get_seen_release_ids(self, user_id: UUID) -> list[str]:
        query = select(UserReleaseView.release_id).where(
            UserReleaseView.user_id == user_id
        )
        return list((await self._session.execute(query)).scalars().all())

    async def add_seen_releases(
        self, user_id: UUID, release_ids: list[str]
    ) -> list[str]:
        """Marca releases como vistos (idempotente) y devuelve el set actualizado."""
        existing = set(await self.get_seen_release_ids(user_id))
        for release_id in release_ids:
            if release_id and release_id not in existing:
                self._session.add(
                    UserReleaseView(user_id=user_id, release_id=release_id)
                )
                existing.add(release_id)
        await self._session.flush()
        return list(existing)


class PositionRepository(BaseRepository[Position]):
    """Catálogo mutable de cargos: admin/super_admin/developer agregan filas
    nuevas en caliente (ver ``POST /identity/positions``), sin migraciones.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=Position, session=session)

    async def list_active(self) -> list[Position]:
        query = (
            select(Position)
            .where(Position.is_active.is_(True))
            .order_by(Position.label)
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_by_key(self, key: str) -> Position | None:
        query = select(Position).where(Position.key == key)
        result = await self._session.execute(query)
        return result.scalars().first()

    async def key_exists(self, key: str) -> bool:
        return await self.get_by_key(key) is not None
