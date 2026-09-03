from uuid import uuid4

from app.modules.files.domain.policy import NO_OWNER, FilesAccess, FolderOwner
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.teams.infrastructure.enums import TeamRole

TEAM_A = uuid4()
TEAM_B = uuid4()
ME = uuid4()
SOMEONE_ELSE = uuid4()

OWNED_BY_A = FolderOwner(team_id=TEAM_A)
OWNED_BY_B = FolderOwner(team_id=TEAM_B)
MINE = FolderOwner(user_id=ME)
THEIRS = FolderOwner(user_id=SOMEONE_ELSE)


def access(
    system_role="user", *, member=False, project_role=None, roles=None, user_id=ME
) -> FilesAccess:
    return FilesAccess.resolve(
        system_role,
        is_project_member=member,
        project_role=project_role,
        team_roles=roles or {},
        user_id=user_id,
    )


class TestFilesAccess:
    def test_project_member_can_view_the_archive(self):
        assert access(member=True).can_view

    def test_stranger_cannot_view(self):
        assert not access().can_view

    def test_team_membership_alone_grants_view(self):
        # Estar en un equipo del proyecto es estar en el proyecto, aunque no
        # aparezca en project_members.
        assert access(roles={TEAM_A: TeamRole.INTEGRANTE}).can_view

    def test_only_lead_or_supervisor_opens_the_team_folder(self):
        assert access(roles={TEAM_A: TeamRole.LIDER}).can_create_team_folder(TEAM_A)
        assert access(roles={TEAM_A: TeamRole.SUPERVISOR}).can_create_team_folder(
            TEAM_A
        )
        assert not access(roles={TEAM_A: TeamRole.INTEGRANTE}).can_create_team_folder(
            TEAM_A
        )

    def test_lead_of_another_team_cannot_open_this_teams_folder(self):
        assert not access(roles={TEAM_A: TeamRole.LIDER}).can_create_team_folder(TEAM_B)

    def test_nobody_writes_directly_in_the_project_root(self):
        # La raíz solo admite carpetas con dueño; ni el admin sube archivos ahí.
        assert not access("admin").can_write_in(NO_OWNER)
        assert not access(roles={TEAM_A: TeamRole.LIDER}).can_write_in(NO_OWNER)

    def test_any_member_of_the_owning_team_writes_inside_its_folder(self):
        assert access(roles={TEAM_A: TeamRole.INTEGRANTE}).can_write_in(OWNED_BY_A)

    def test_member_of_another_team_cannot_write_in_this_folder(self):
        assert not access(roles={TEAM_B: TeamRole.LIDER}).can_write_in(OWNED_BY_A)

    def test_admin_writes_anywhere_below_the_root(self):
        assert access("admin").can_write_in(OWNED_BY_A)


class TestArchiveVisibility:
    """Quién ve QUÉ dentro del archivador. Entrar y ver son cosas distintas:
    se entra por estar en el proyecto, se ve por dueño de la carpeta."""

    def test_admin_sees_the_whole_hierarchy(self):
        assert access("admin").sees_whole_project
        assert access("super_admin").sees_whole_project
        assert access("developer").sees_whole_project

    def test_project_coordinator_and_supervisor_are_scoped_to_their_own_teams(self):
        # El espacio de trabajo es un contexto de equipo: aunque coordine o
        # supervise el proyecto, sin ser administración del sistema solo ve la
        # carpeta de los equipos donde está. La jerarquía completa es del panel
        # de administración.
        for role in (ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR):
            a = access(member=True, project_role=role, roles={TEAM_A: TeamRole.LIDER})
            assert not a.sees_whole_project
            assert a.can_see(OWNED_BY_A)
            assert not a.can_see(OWNED_BY_B)

    def test_team_lead_sees_only_their_own_teams_folder(self):
        a = access(roles={TEAM_A: TeamRole.LIDER})
        assert not a.sees_whole_project
        assert a.can_see(OWNED_BY_A)
        assert not a.can_see(OWNED_BY_B)

    def test_team_member_sees_their_teams_folder(self):
        # Ahí es donde caen sus propias entregas: no verla no tendría sentido.
        assert access(roles={TEAM_A: TeamRole.INTEGRANTE}).can_see(OWNED_BY_A)

    def test_plain_project_member_without_a_team_sees_nothing_inside(self):
        a = access(member=True, project_role=ProjectRole.INTEGRANTE)
        assert a.can_view  # entra y ve la raíz vacía, no un 403
        assert not a.can_see(OWNED_BY_A)

    def test_ownerless_first_level_folder_is_only_for_system_admins(self):
        assert access("admin").can_see(NO_OWNER)
        assert not access(roles={TEAM_A: TeamRole.LIDER}).can_see(NO_OWNER)
        assert not access(member=True, project_role=ProjectRole.COORDINADOR).can_see(
            NO_OWNER
        )

    def test_seeing_everything_is_not_writing_everywhere(self):
        # El admin del sistema ve el archivador entero; ver la carpeta de un
        # equipo no es lo mismo que ser de ese equipo, pero el admin además
        # escribe en cualquier parte por su rol (ver test aparte).
        a = access("admin")
        assert a.sees_whole_project
        assert a.can_see(OWNED_BY_A)
        assert a.can_see(OWNED_BY_B)


class TestPersonalFolder:
    """La carpeta de una persona: donde cae la entrega de una tarea individual,
    que no tiene equipo al que pertenecer."""

    def test_owner_sees_and_writes_in_their_own_folder(self):
        a = access(member=True)
        assert a.can_see(MINE)
        assert a.can_write_in(MINE)

    def test_nobody_else_sees_it_even_leading_a_team(self):
        a = access(roles={TEAM_A: TeamRole.LIDER})
        assert not a.can_see(THEIRS)
        assert not a.can_write_in(THEIRS)

    def test_project_coordinator_does_not_see_someone_elses_personal_folder(self):
        # Coordinar el proyecto ya no abre el archivador entero: la carpeta
        # individual de otra persona solo la ve esa persona o la administración
        # del sistema.
        a = access(member=True, project_role=ProjectRole.COORDINADOR)
        assert not a.can_see(THEIRS)
        assert not a.can_write_in(THEIRS)

    def test_system_admin_sees_someone_elses_personal_folder(self):
        assert access("admin").can_see(THEIRS)

    def test_admin_writes_in_anyones_folder(self):
        assert access("admin").can_write_in(THEIRS)
