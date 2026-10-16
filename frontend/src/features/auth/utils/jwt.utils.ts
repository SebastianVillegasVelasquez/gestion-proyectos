import type { JwtPayload } from "@/features/auth/types";

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) {
    return true;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - skewSeconds <= nowSeconds;
}

/**
 * ¿Sabemos a ciencia cierta que el token venció? Solo true cuando se pudo leer
 * un `exp` y ya pasó.
 *
 * Es lo contrario de `isTokenExpired` ante un token ilegible: ahí un token que
 * no se puede descodificar cuenta como vencido (para `readSession`, donde un
 * valor basura no debe pasar por sesión válida), pero para decidir si renovamos
 * ANTES de enviar hay que asumir que sirve: si no, un token opaco dispararía una
 * renovación en cada petición, en bucle.
 */
export function isKnownExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) {
    return false;
  }
  return payload.exp - skewSeconds <= Math.floor(Date.now() / 1000);
}
