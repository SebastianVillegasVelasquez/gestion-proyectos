from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.teams.infrastructure.enums import TeamRole

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin", "developer"}
# Quien coordina o audita el PROYECTO ve el archivador entero. No es un permiso
# de equipo: es su trabajo mirar el proyecto completo, y un coordinador que solo
# viera las carpetas de los equipos donde está metido no podría hacerlo.
_OVERSEER_PROJECT_ROLES = {ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR}
# Quien puede reclamar la carpeta del equipo en la raíz. Crearla es un acto de
# organización, no de trabajo diario: la abre quien coordina.
_FOLDER_OWNER_TEAM_ROLES = {TeamRole.LIDER, TeamRole.SUPERVISOR}


@dataclass(frozen=True)
class FilesAccess:
    """Qué puede hacer una persona en el archivador de un proyecto.

    Lógica pura y única fuente de verdad de la autorización del módulo: las
    rutas y los casos de uso preguntan, no deciden.

    La forma del archivador es deliberadamente estrecha —la raíz es del
    proyecto, el primer nivel es «una carpeta por equipo»— porque un archivador
    plano donde todos crean en la raíz deja de ser navegable en cuestión de
    semanas. Y la VISIBILIDAD sigue esa misma forma: cada equipo ve su carpeta,
    y solo quien mira el proyecto entero (administración, coordinación,
    supervisión) ve la jerarquía completa desde la raíz.
    """

    is_admin: bool
    is_project_member: bool
    project_role: ProjectRole | None
    """Rol del usuario en cada equipo del proyecto al que pertenece."""
    team_roles: dict[UUID, TeamRole]

    @classmethod
    def resolve(
        cls,
        system_role: str,
        *,
        is_project_member: bool,
        project_role: ProjectRole | None = None,
        team_roles: dict[UUID, TeamRole],
    ) -> "FilesAccess":
        return cls(
            is_admin=system_role in _ADMIN_SYSTEM_ROLES,
            is_project_member=is_project_member,
            project_role=project_role,
            team_roles=team_roles,
        )

    @property
    def sees_whole_project(self) -> bool:
        """¿Ve el archivador COMPLETO, carpeta de equipo por carpeta de equipo?

        Administración del sistema y quien coordina o supervisa el proyecto.
        Para el resto, el archivador se recorta a sus equipos.
        """
        return self.is_admin or self.project_role in _OVERSEER_PROJECT_ROLES

    @property
    def can_view(self) -> bool:
        """Quién puede abrir el archivador.

        Estar en el proyecto basta para entrar; lo que se ve DENTRO ya depende
        de `can_see_team`. Un integrante del proyecto sin equipo entra y ve la
        raíz vacía —que es la verdad— en vez de un 403 que parece un error.
        """
        return self.is_admin or self.is_project_member or bool(self.team_roles)

    def can_see_team(self, team_id: UUID | None) -> bool:
        """¿Se le muestra la carpeta de este equipo (y todo lo que cuelga)?

        `None` es una carpeta de primer nivel sin dueño: no debería existir
        (la política de creación lo impide), pero si la hubiera solo la ve
        quien ve el proyecto entero, nunca un equipo por accidente.
        """
        if self.sees_whole_project:
            return True
        return team_id is not None and team_id in self.team_roles

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

        Ojo: ver no es escribir. Un coordinador ve todas las carpetas, pero
        subir contenido dentro de la de un equipo sigue siendo de ese equipo
        (o de administración).
        """
        if owner_team_id is None:
            return False
        return self.is_admin or owner_team_id in self.team_roles
