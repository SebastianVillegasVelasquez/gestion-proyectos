import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  clearSession,
  readSession,
  writeSession,
  type Session,
} from "@/features/auth/utils/session.utils";
import { decodeJwt, isTokenExpired } from "@/features/auth/utils/jwt.utils";

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
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
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
      hasRole: (roles) => Boolean(session && roles.includes(session.user.role)),
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
