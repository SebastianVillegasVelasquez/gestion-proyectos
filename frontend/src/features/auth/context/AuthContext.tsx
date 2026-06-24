import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  clearSession,
  readSession,
  writeSession,
  type Session,
} from "@/features/auth/utils/session.utils";
import { decodeJwt, isTokenExpired } from "@/features/auth/utils/jwt.utils";
import { SESSION_REFRESHED_EVENT } from "@/features/auth/api/refresh";

export { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const login = useCallback((next: Session) => {
    writeSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
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
    // re-leemos la sesión para reiniciar el temporizador de expiración.
    const onRefreshed = () => {
      setSession(readSession());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_REFRESHED_EVENT, onRefreshed);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_REFRESHED_EVENT, onRefreshed);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    const payload = decodeJwt(session.accessToken);
    if (!payload?.exp) {
      return;
    }
    const msUntilExpiry = Math.max(0, payload.exp * 1000 - Date.now());
    const timer = setTimeout(() => {
      if (isTokenExpired(session.accessToken)) {
        logout();
      }
    }, msUntilExpiry);
    return () => {
      clearTimeout(timer);
    };
  }, [session, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      // Jerarquía: developer (rol técnico) es el tope y satisface cualquier guard
      // de rol, igual que en el backend (role_satisfies).
      hasRole: (roles) =>
        Boolean(
          session && (session.user.role === "developer" || roles.includes(session.user.role)),
        ),
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
