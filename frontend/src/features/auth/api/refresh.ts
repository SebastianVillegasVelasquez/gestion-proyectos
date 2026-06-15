import axios from "axios";
import { clearSession, writeSession } from "@/features/auth/utils/session.utils";
import type { LoginResponse } from "@/features/auth/types";

// Evento que avisa al AuthContext que la sesión se renovó en esta misma pestaña
// (el evento `storage` solo se dispara entre pestañas distintas).
export const SESSION_REFRESHED_EVENT = "auth:refreshed";

// Single-flight: si varias peticiones fallan con 401 a la vez, comparten un
// único intento de refresco en lugar de disparar N llamadas.
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    return null;
  }
  try {
    // axios "crudo" (sin el interceptor) para evitar recursión en el 401.
    const res = await axios.post<LoginResponse>(
      `${import.meta.env.VITE_API_URL}/identity/auth/refresh`,
      { refresh_token: refreshToken },
    );
    writeSession({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      user: res.data.user,
    });
    window.dispatchEvent(new Event(SESSION_REFRESHED_EVENT));
    return res.data.access_token;
  } catch {
    clearSession();
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
