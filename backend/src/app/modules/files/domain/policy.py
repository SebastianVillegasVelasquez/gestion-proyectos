from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.modules.teams.infrastructure.enums import TeamRole

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin", "developer"}
# Quien puede reclamar la carpeta del equipo en la raíz. Crearla es un acto de
# organización, no de trabajo diario: la abre quien coordina.
_FOLDER_OWNER_TEAM_ROLES = {TeamRole.LIDER, TeamRole.SUPERVISOR}


@dataclass(frozen=True)
class FilesAccess:
    """Qué puede hacer una persona en el archivador de un proyecto.

    Lógica pura y única fuente de verdad de la autorización del módulo: las
    rutas y los casos de uso preguntan, no deciden. Las reglas de la primera
    versión son deliberadamente estrechas —la raíz es del proyecto, el primer
    nivel es «una carpeta por equipo»— porque un archivador plano donde todos
    crean en la raíz deja de ser navegable en cuestión de semanas.
    """

    is_admin: bool
    is_project_member: bool
    """Rol del usuario en cada equipo del proyecto al que pertenece."""
    team_roles: dict[UUID, TeamRole]

    @classmethod
    def resolve(
        cls,
        system_role: str,
        *,
        is_project_member: bool,
        team_roles: dict[UUID, TeamRole],
    ) -> "FilesAccess":
        return cls(
            is_admin=system_role in _ADMIN_SYSTEM_ROLES,
            is_project_member=is_project_member,
            team_roles=team_roles,
        )

    @property
    def can_view(self) -> bool:
        """El archivador es del proyecto: lo ve todo el que está dentro de él."""
        return self.is_admin or self.is_project_member or bool(self.team_roles)

    def can_create_team_folder(self, team_id: UUID) -> bool:
        """Abrir la carpeta de un equipo en la raíz: el admin, o quien lidera
        o supervisa ESE equipo."""
        return self.is_admin or self.team_roles.get(team_id) in _FOLDER_OWNER_TEAM_ROLES

    def can_write_in(self, owner_team_id: UUID | None) -> bool:
        """Crear subcarpetas y subir archivos dentro de la carpeta de un equipo.

        `owner_team_id` es el equipo del ancestro de primer nivel. `None` es la
        raíz del proyecto: ahí no escribe nadie salvo para abrir una carpeta de
        equipo (ver `can_create_team_folder`), que es la regla que mantiene el
        primer nivel legible.
        """
        if owner_team_id is None:
            return False
        return self.is_admin or owner_team_id in self.team_roles
