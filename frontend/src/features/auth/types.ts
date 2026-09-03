export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  position?: string;
  // Primer ingreso: el backend lo marca en cuentas nuevas y tras un reset de
  // admin. Mientras sea true la app bloquea todo con el modal de bienvenida
  // hasta que la persona crea su propia contraseña.
  must_change_password?: boolean;
  /** Ruta de la foto de perfil RELATIVA a la API (o null si no tiene). Se
   *  compone con `VITE_API_URL` al pintarla: el dominio cambia por entorno. */
  avatar_url?: string | null;
  /** Presentación breve que la persona escribe sobre sí misma. */
  bio?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export const Role = {
  DEVELOPER: "developer",
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// Jerarquía numérica de roles, espejo de app.shared.authz.ROLE_RANK en el
// backend: se usa para decidir en la UI quién puede asignar/eliminar a quién,
// aunque la validación real vive en la API.
const ROLE_RANK: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.ADMIN]: 2,
  [Role.SUPER_ADMIN]: 3,
  [Role.DEVELOPER]: 4,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role] ?? 0;
}

/** ¿El actor tiene rango estrictamente mayor que el objetivo? (p. ej. para eliminar cuentas). */
export function canActOnTarget(actorRole: Role, targetRole: Role): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}

export interface JwtPayload {
  sub: string;
  role?: Role;
  exp: number;
  iat?: number;
}
