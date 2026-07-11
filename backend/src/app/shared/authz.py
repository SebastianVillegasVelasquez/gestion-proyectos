from collections.abc import Sequence

from app.modules.identity.infrastructure.enums import SystemRole


def role_satisfies(user_role: str, allowed_roles: Sequence[str]) -> bool:
    """¿El rol del usuario satisface alguno de los roles permitidos?

    DEVELOPER es el tope de la jerarquía (developer ⊇ super_admin ⊇ admin ⊇ user):
    satisface cualquier requisito, así no hay que añadirlo a cada lista de roles.
    El resto de roles deben coincidir explícitamente.
    """
    if user_role == SystemRole.DEVELOPER:
        return True
    return user_role in allowed_roles
