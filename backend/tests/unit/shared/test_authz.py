"""Jerarquía de roles: DEVELOPER es el tope y satisface cualquier requisito."""

from app.modules.identity.infrastructure.enums import SystemRole
from app.shared.authz import role_satisfies


class TestRoleSatisfies:
    def test_developer_passes_any_requirement(self):
        # Tope de la jerarquía: pasa aunque no esté en la lista permitida.
        assert role_satisfies(SystemRole.DEVELOPER, [SystemRole.SUPER_ADMIN])
        assert role_satisfies(SystemRole.DEVELOPER, [SystemRole.ADMIN, SystemRole.USER])
        assert role_satisfies(SystemRole.DEVELOPER, ["developer"])

    def test_exact_match_for_other_roles(self):
        assert role_satisfies(SystemRole.ADMIN, [SystemRole.ADMIN, SystemRole.USER])
        assert role_satisfies(SystemRole.SUPER_ADMIN, ["super_admin"])

    def test_denies_when_not_in_list(self):
        # super_admin NO debe pasar un requisito exclusivo de developer (feedback).
        assert not role_satisfies(SystemRole.SUPER_ADMIN, [SystemRole.DEVELOPER])
        assert not role_satisfies(SystemRole.USER, [SystemRole.ADMIN])
        assert not role_satisfies(SystemRole.ADMIN, [SystemRole.SUPER_ADMIN])
