import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  clearSession,
  readSession,
  writeSession,
  type Session,
} from "@/features/auth/utils/session.utils";
import { decodeJwt } from "@/features/auth/utils/jwt.utils";
import { previewableRoles, readViewAsRole, writeViewAsRole } from "@/features/auth/utils/view-as";
import { writeViewAsTeamRole } from "@/features/auth/utils/view-as-team-role";
import type { Role } from "@/features/auth/types";
import {
  SESSION_ENDED_EVENT,
  SESSION_REFRESHED_EVENT,
  refreshAccessToken,
} from "@/features/auth/api/refresh";
import { USER_REVALIDATED_EVENT, revalidateUser } from "@/features/auth/api/revalidate";

// Margen para renovar el token ANTES de que expire y no dejar una ventana en la
// que las peticiones fallen con 401.
const REFRESH_SKEW_MS = 30_000;

export { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [requestedViewAs, setRequestedViewAs] = useState<Role | null>(() => readViewAsRole());

  const setViewAsRole = useCallback((role: Role | null) => {
    writeViewAsRole(role);
    setRequestedViewAs(role);
  }, []);

  const login = useCallback((next: Session) => {
    writeSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    writeViewAsRole(null);
    writeViewAsTeamRole(null);
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "access_token" || e.key === "auth_user") {
        setSession(readSession());
      }
    };
    // El interceptor renueva el token de forma silenciosa (misma pestaña);
    // re-leemos la sesión para reiniciar el temporizador de expiración. El mismo
    // gesto sirve cuando la revalidación de usuario detecta un cambio (p. ej. de
    // rol) y cuando la renovación falla y la sesión queda cerrada: ahí
    // `readSession()` devuelve null y el ProtectedRoute lleva al login.
    const onSessionChanged = () => {
      setSession(readSession());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_REFRESHED_EVENT, onSessionChanged);
    window.addEventListener(USER_REVALIDATED_EVENT, onSessionChanged);
    window.addEventListener(SESSION_ENDED_EVENT, onSessionChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_REFRESHED_EVENT, onSessionChanged);
      window.removeEventListener(USER_REVALIDATED_EVENT, onSessionChanged);
      window.removeEventListener(SESSION_ENDED_EVENT, onSessionChanged);
    };
  }, []);

  // Revalida el usuario contra el servidor al abrir la app y cada vez que la
  // pestaña vuelve al primer plano. Así un cambio de rol hecho por un admin se
  // refleja en la navegación y los RoleGuard en segundos, sin forzar re-login.
  useEffect(() => {
    if (!session) {
      return;
    }
    void revalidateUser(true);
    const onFocus = () => void revalidateUser();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void revalidateUser();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Solo depende de si hay sesión y de quién es; no del objeto completo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken == null, session?.user.id]);

  // Al montar: si no hay sesión válida (access token vencido) pero aún queda un
  // refresh token, renovamos en silencio en vez de exigir un nuevo login. Cubre
  // recargar la página tras más de una hora inactivo.
  useEffect(() => {
    if (session || !localStorage.getItem("refresh_token")) {
      return;
    }
    void refreshAccessToken().then((token) => {
      if (token) {
        setSession(readSession());
      }
    });
    // Solo al montar: el resto del ciclo lo maneja el temporizador de renovación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renueva el access token de forma proactiva un poco antes de que expire, para
  // mantener la sesión viva mientras el refresh token siga vigente (30 días). Si
  // la renovación falla (refresh token vencido/revocado), recién ahí cerramos.
  useEffect(() => {
    if (!session) {
      return;
    }
    const payload = decodeJwt(session.accessToken);
    if (!payload?.exp) {
      return;
    }
    const msUntilRefresh = Math.max(0, payload.exp * 1000 - Date.now() - REFRESH_SKEW_MS);
    const timer = setTimeout(() => {
      void refreshAccessToken().then((token) => {
        if (!token) {
          logout();
        }
        // En éxito, SESSION_REFRESHED_EVENT reajusta la sesión y reprograma el timer.
      });
    }, msUntilRefresh);
    return () => {
      clearTimeout(timer);
    };
  }, [session, logout]);

  const value = useMemo<AuthContextValue>(() => {
    const realRole = session?.user.role ?? null;
    const allowed = previewableRoles(realRole);
    // Un rol guardado que ya no corresponde (p. ej. te bajaron de rango) se ignora.
    const viewAsRole =
      requestedViewAs && allowed.includes(requestedViewAs) ? requestedViewAs : null;
    const effectiveRole = viewAsRole ?? realRole;
    return {
      // Con vista previa, la app entera —navegación, guards, pantallas— se
      // comporta como el rol elegido; la API sigue aplicando el rol real.
      user: session ? { ...session.user, role: effectiveRole ?? session.user.role } : null,
      isAuthenticated: session !== null,
      // Jerarquía: developer (rol técnico) es el tope y satisface cualquier guard
      // de rol, igual que en el backend (role_satisfies).
      hasRole: (roles) =>
        Boolean(
          session &&
          effectiveRole &&
          (effectiveRole === "developer" || roles.includes(effectiveRole)),
        ),
      realRole,
      viewAsRole,
      previewableRoles: allowed,
      setViewAsRole,
      login,
      logout,
    };
  }, [session, requestedViewAs, setViewAsRole, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
