import http from "@/lib/http";
import { readSession, writeSession } from "@/features/auth/utils/session.utils";
import type { AuthUser } from "@/features/auth/types";

// Avisa al AuthContext (misma pestaña) que `auth_user` cambió tras revalidar
// contra el servidor. El evento `storage` solo cruza pestañas distintas.
export const USER_REVALIDATED_EVENT = "auth:user-revalidated";

// El backend ya aplica el rol nuevo en la siguiente petición (lo lee de la BD,
// no del JWT). Lo único que queda desincronizado tras un cambio de rol es la
// copia local del usuario en `localStorage`, que mueve la navegación y los
// RoleGuard. Esto la vuelve a pedir y la actualiza si cambió algo.

let inFlight: Promise<void> | null = null;
let lastRun = 0;
// Al enfocar la ventana puede dispararse varias veces seguidas; no tiene sentido
// pegarle al endpoint más de una vez cada pocos segundos.
const MIN_INTERVAL_MS = 10_000;

async function doRevalidate(): Promise<void> {
  const session = readSession();
  if (!session) {
    return;
  }
  let user: AuthUser;
  try {
    user = (await http.get<AuthUser>("/identity/me")).data;
  } catch {
    // Error transitorio (red, 5xx): no tocamos la sesión. Un 401 real lo maneja
    // el interceptor de `http` (refresh silencioso o cierre de sesión).
    return;
  }
  const current = session.user;
  const changed =
    user.role !== current.role ||
    user.name !== current.name ||
    user.email !== current.email ||
    user.position !== current.position ||
    // Al crear su contraseña propia, el flag pasa a false: hay que reflejarlo
    // para que el modal de primer ingreso se cierre sin recargar la página.
    Boolean(user.must_change_password) !== Boolean(current.must_change_password);
  if (!changed) {
    return;
  }
  writeSession({ ...session, user });
  window.dispatchEvent(new Event(USER_REVALIDATED_EVENT));
}

/**
 * Revalida el usuario autenticado contra `GET /identity/me`.
 *
 * Single-flight + intervalo mínimo: llamadas concurrentes comparten la misma
 * petición y las que llegan poco después de la anterior se ignoran. `force`
 * salta el intervalo (para un disparo explícito, p. ej. al montar).
 */
export function revalidateUser(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRun < MIN_INTERVAL_MS) {
    return inFlight ?? Promise.resolve();
  }
  if (inFlight) {
    return inFlight;
  }
  lastRun = now;
  inFlight = doRevalidate().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
