from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.teams.infrastructure.enums import TeamRole

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin", "developer"}
# Quien puede reclamar la carpeta del equipo en la raíz. Crearla es un acto de
# organización, no de trabajo diario: la abre quien coordina.
_FOLDER_OWNER_TEAM_ROLES = {TeamRole.LIDER, TeamRole.SUPERVISOR}


@dataclass(frozen=True)
class FolderOwner:
    """De quién es una carpeta de primer nivel: de un equipo o de una persona.

    Nunca de los dos, y la raíz del proyecto no es de nadie (`NO_OWNER`). Tenerlo
    como un valor —y no como dos parámetros sueltos— es lo que evita que cada
    llamada tenga que acordarse de pasar los dos y decidir cuál manda.
    """

    team_id: UUID | None = None
    user_id: UUID | None = None

    @property
    def is_root(self) -> bool:
        return self.team_id is None and self.user_id is None


NO_OWNER = FolderOwner()


@dataclass(frozen=True)
class FilesAccess:
    """Qué puede hacer una persona en el archivador de un proyecto.

    Lógica pura y única fuente de verdad de la autorización del módulo: las
    rutas y los casos de uso preguntan, no deciden.

    La forma del archivador es deliberadamente estrecha —la raíz es del
    proyecto, el primer nivel es «una carpeta por dueño» (un equipo, o una
    persona para sus entregas individuales)— porque un archivador plano donde
    todos crean en la raíz deja de ser navegable en cuestión de semanas. Y la
    VISIBILIDAD sigue esa misma forma: cada dueño ve su carpeta y la raíz
    (vacía), y solo la administración del sistema (admin / super_admin /
    developer) ve la jerarquía completa. Un líder —aunque además coordine o
    supervise el proyecto— ve en su espacio de trabajo únicamente la carpeta
    de su equipo y la raíz, no las de los demás equipos.
    """

    is_admin: bool
    is_project_member: bool
    project_role: ProjectRole | None
    """Rol del usuario en cada equipo del proyecto al que pertenece."""
    team_roles: dict[UUID, TeamRole]
    user_id: UUID | None = None

    @classmethod
    def resolve(
        cls,
        system_role: str,
        *,
        is_project_member: bool,
        project_role: ProjectRole | None = None,
        team_roles: dict[UUID, TeamRole],
        user_id: UUID | None = None,
    ) -> "FilesAccess":
        return cls(
            is_admin=system_role in _ADMIN_SYSTEM_ROLES,
            is_project_member=is_project_member,
            project_role=project_role,
            team_roles=team_roles,
            user_id=user_id,
        )

    @property
    def sees_whole_project(self) -> bool:
        """¿Ve el archivador COMPLETO, carpeta de equipo por carpeta de equipo?

        Solo la administración del sistema (admin / super_admin / developer).
        Para el resto —integrantes, líderes, y también quien coordina o
        supervisa el proyecto— el archivador se recorta a sus propios equipos:
        el espacio de trabajo es un contexto de equipo, no el panel global.
        """
        return self.is_admin

    @property
    def can_view(self) -> bool:
        """Quién puede abrir el archivador.

        Estar en el proyecto basta para entrar; lo que se ve DENTRO ya depende
        de `can_see`. Un integrante del proyecto sin equipo entra y ve la
        raíz vacía —que es la verdad— en vez de un 403 que parece un error.
        """
        return self.is_admin or self.is_project_member or bool(self.team_roles)

    def can_see(self, owner: FolderOwner) -> bool:
        """¿Se le muestra esta carpeta de primer nivel (y todo lo que cuelga)?

        Una carpeta sin dueño no debería existir (la política de creación lo
        impide), pero si la hubiera solo la ve quien ve el proyecto entero,
        nunca un equipo ni una persona por accidente.
        """
        if self.sees_whole_project:
            return True
        if owner.team_id is not None:
            return owner.team_id in self.team_roles
        return owner.user_id is not None and owner.user_id == self.user_id

    def can_create_team_folder(self, team_id: UUID) -> bool:
        """Abrir la carpeta de un equipo en la raíz: el admin, o quien lidera
        o supervisa ESE equipo."""
        return self.is_admin or self.team_roles.get(team_id) in _FOLDER_OWNER_TEAM_ROLES

    def can_write_in(self, owner: FolderOwner) -> bool:
        """Crear subcarpetas y subir archivos dentro de la carpeta de un dueño.

        `owner` es el del ancestro de primer nivel. Sin dueño es la raíz del
        proyecto: ahí no escribe nadie salvo para abrir una carpeta de equipo
        (ver `can_create_team_folder`), que es la regla que mantiene el primer
        nivel legible.

        Ojo: ver no es escribir. Un coordinador ve todas las carpetas, pero
        subir contenido dentro de la de un equipo sigue siendo de ese equipo
        (o de administración), y la carpeta de una persona es solo suya.
        """
        if owner.is_root:
            return False
        if self.is_admin:
            return True
        if owner.team_id is not None:
            return owner.team_id in self.team_roles
        return owner.user_id == self.user_id
