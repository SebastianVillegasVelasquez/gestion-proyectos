from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.project.infrastructure.models import (
    Module,
    Project,
    ProjectMember,
    ProjectStatus,
    Risk,
)
from app.shared.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    """
    El BaseRepository ya cubre get / create / update / soft_delete / list.
    No necesitamos métodos extra para el MVP; los filtros de list() son
    suficientes porque list(filters={"is_template": False}) ya funciona.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=Project, session=session)

    async def list_by_coordinator(
            self, coordinator_id: uuid.UUID, *, include_templates: bool = False
    ) -> Sequence[Project]:
        """
        Alias semántico útil para el dashboard del coordinador.
        Equivale a list(filters={...}) pero con nombre más expresivo
        y evita que el servicio construya dicts de filtros a mano.
        """
        stmt = select(Project).where(
            and_(
                Project.coordinator_id == coordinator_id,
                Project.deleted_at.is_(None),
                *([] if include_templates else [Project.is_template.is_(False)]),
                )
        ).order_by(Project.created_at.desc())

        result = await self._session.execute(stmt)
        return result.scalars().all()


class ProjectStatusRepository(BaseRepository[ProjectStatus]):
    """
    Métodos adicionales:
      get_default_for_project  → devuelve el estado marcado is_default=True.
      list_ordered             → lista los estados de un proyecto por su campo order.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=ProjectStatus, session=session)

    async def get_default_for_project(
            self, project_id: uuid.UUID
    ) -> ProjectStatus | None:
        """
        Devuelve el estado default de un proyecto.
        Se usa al crear el proyecto para asignar current_status_id
        justo después de sembrar los estados base.
        """
        stmt = select(ProjectStatus).where(
            and_(
                ProjectStatus.project_id == project_id,
                ProjectStatus.is_default.is_(True),
                )
        ).limit(1)

        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_ordered(
            self, project_id: uuid.UUID
    ) -> Sequence[ProjectStatus]:
        """
        Lista los estados de un proyecto ordenados por su campo `order`.
        El frontend los consume en este orden para construir el pipeline visual.
        """
        stmt = (
            select(ProjectStatus)
            .where(ProjectStatus.project_id == project_id)
            .order_by(ProjectStatus.order.asc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()


class ProjectMemberRepository(BaseRepository[ProjectMember]):
    """
    Método adicional crítico:
      get_by(project_id, user_id)  → busca por clave compuesta.

    El BaseRepository sólo busca por PK (UUID). La relación proyecto↔usuario
    es una clave compuesta, así que necesitamos esta consulta dedicada.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=ProjectMember, session=session)

    async def get_by(
            self, *, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> ProjectMember | None:
        """
        Busca si un usuario ya es miembro de un proyecto específico.

        Uso en el servicio:
          - Antes de add_member → detectar duplicados (MemberAlreadyExists).
          - En remove_member / update_member_role → obtener la PK real
            del registro para pasarla a update() o delete().
        """
        stmt = select(ProjectMember).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                )
        ).limit(1)

        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_by_user(
            self, user_id: uuid.UUID
    ) -> Sequence[ProjectMember]:
        """
        Devuelve todos los proyectos a los que pertenece un usuario.
        Útil para el panel personal del colaborador.
        """
        stmt = select(ProjectMember).where(ProjectMember.user_id == user_id)
        result = await self._session.execute(stmt)
        return result.scalars().all()


class ModuleRepository(BaseRepository[Module]):
    """
    El BaseRepository genérico cubre todo lo necesario.
    list(filters={"project_id": id, "deleted_at": None}) funciona
    porque el genérico aplica los filtros por igualdad de columnas.

    Agregamos list_ordered como comodidad para el frontend.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=Module, session=session)

    async def list_ordered(
            self, project_id: uuid.UUID, *, include_deleted: bool = False
    ) -> Sequence[Module]:
        """
        Lista los módulos de un proyecto ordenados por `order`.
        El Gantt y el tablero Kanban necesitan este orden garantizado.
        """
        conditions = [Module.project_id == project_id]
        if not include_deleted:
            conditions.append(Module.deleted_at.is_(None))

        stmt = (
            select(Module)
            .where(and_(*conditions))
            .order_by(Module.order.asc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()


class RiskRepostory(BaseRepository[Risk]):
    """
    Risk usa hard-delete real (no tiene campo deleted_at en el modelo).
    El BaseRepository.delete() ya hace hard-delete por PK, así que
    mantenemos consistencia y eliminamos el print de debug.

    Agregamos list_active como consulta semántica frecuente.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=Risk, session=session)

    async def list_active(self, project_id: uuid.UUID) -> Sequence[Risk]:
        """
        Devuelve sólo los riesgos activos de un proyecto.
        El servicio get_risk_summary() y el módulo de IA usan esto
        para no contabilizar riesgos ya mitigados/cerrados.
        """
        stmt = select(Risk).where(
            and_(
                Risk.project_id == project_id,
                Risk.is_active.is_(True),
                )
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()