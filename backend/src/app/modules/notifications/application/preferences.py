"""Preferencias de aviso por-equipo y ayudantes de destinatarios.

Los toggles de «Configuración del equipo» (tabla ``team_notification_settings``)
son personales y por-equipo. Estos ayudantes dejan que los manejadores de
notificaciones los respeten sin acoplarse al módulo de equipos: reciben la
misma ``AsyncSession`` del request y hacen una consulta puntual.

Regla de ausencia: sin fila guardada, TODO está activado (igual que en
``WorkspaceService.get_notifications`` y que el ``server_default`` de la tabla).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.teams.infrastructure.workspace_models import TeamNotificationSetting

# Roles de proyecto a los que «les interesa» que una tarea se apruebe: la
# aprobación sube el % del proyecto (dato de coordinación y de auditoría).
_PROJECT_LEAD_ROLES = (ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR)


class TeamNotificationGate:
    """¿Debe el usuario recibir este tipo de aviso en este equipo?"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def allows(self, *, team_id: UUID | None, user_id: UUID, field: str) -> bool:
        # Fuera de un equipo no hay preferencias por-equipo que aplicar.
        if team_id is None:
            return True
        row = await self._session.scalar(
            select(TeamNotificationSetting).where(
                TeamNotificationSetting.team_id == team_id,
                TeamNotificationSetting.user_id == user_id,
            )
        )
        if row is None:
            return True
        return bool(getattr(row, field, True))


async def project_lead_ids(
    session: AsyncSession, project_id: UUID, *, exclude: set[UUID] | None = None
) -> list[UUID]:
    """Coordinadores y supervisores (no borrados) del proyecto."""
    exclude = exclude or set()
    rows = await session.execute(
        select(ProjectMember.user_id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.project_role.in_(_PROJECT_LEAD_ROLES),
            ProjectMember.deleted_at.is_(None),
        )
    )
    return [uid for uid in rows.scalars().all() if uid not in exclude]
