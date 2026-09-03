from uuid import uuid4

from app.modules.files.domain.policy import FilesAccess
from app.modules.teams.infrastructure.enums import TeamRole

TEAM_A = uuid4()
TEAM_B = uuid4()


def access(system_role="user", *, member=False, roles=None) -> FilesAccess:
    return FilesAccess.resolve(
        system_role, is_project_member=member, team_roles=roles or {}
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
        # La raíz solo admite carpetas de equipo; ni el admin sube archivos ahí.
        assert not access("admin").can_write_in(None)
        assert not access(roles={TEAM_A: TeamRole.LIDER}).can_write_in(None)

    def test_any_member_of_the_owning_team_writes_inside_its_folder(self):
        assert access(roles={TEAM_A: TeamRole.INTEGRANTE}).can_write_in(TEAM_A)

    def test_member_of_another_team_cannot_write_in_this_folder(self):
        assert not access(roles={TEAM_B: TeamRole.LIDER}).can_write_in(TEAM_A)

    def test_admin_writes_anywhere_below_the_root(self):
        assert access("admin").can_write_in(TEAM_A)
