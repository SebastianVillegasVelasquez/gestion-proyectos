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


# Jerarquía numérica para comparar "quién puede actuar sobre quién" (asignar
# rol, eliminar cuenta), a diferencia de role_satisfies que solo valida acceso
# a una ruta.
ROLE_RANK: dict[str, int] = {
    SystemRole.USER: 1,
    SystemRole.ADMIN: 2,
    SystemRole.SUPER_ADMIN: 3,
    SystemRole.DEVELOPER: 4,
}


def role_rank(role: str) -> int:
    return ROLE_RANK.get(role, 0)


def can_assign_role(actor_role: str, target_role: str | None) -> bool:
    """Solo super_admin/developer pueden asignar el rol super_admin (o superior).

    Evita que un admin se autopromueva o promueva a otros vía payload directo.
    Para roles por debajo de super_admin (user/admin) no hay restricción extra
    aquí (eso ya lo cubre require_role en la ruta).
    """
    if target_role is None or role_rank(target_role) < role_rank(
        SystemRole.SUPER_ADMIN
    ):
        return True
    return role_rank(actor_role) >= role_rank(target_role)


def can_act_on_target(actor_role: str, target_role: str) -> bool:
    """¿El actor tiene rango estrictamente mayor que el objetivo?

    Usado para restringir acciones destructivas (eliminar cuenta): un admin no
    puede eliminar a un super_admin, pero un super_admin sí puede eliminar a
    un admin.
    """
    return role_rank(actor_role) > role_rank(target_role)
