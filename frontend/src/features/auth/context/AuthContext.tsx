import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, Role } from "@/features/auth/types";
import { clearSession, readSession, writeSession, type Session } from "@/features/auth/utils/session.utils";
import { isTokenExpired } from "@/features/auth/utils/jwt.utils";

interface AuthContextValue {
    user: AuthUser | null;
    isAuthenticated: boolean;
    hasRole: (roles: Role[]) => boolean;
    login: (session: Session) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

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
        return () => { window.removeEventListener("storage", onStorage); };
    }, []);

    useEffect(() => {
        if (!session) return;
        const payload = JSON.parse(atob(session.accessToken.split(".")[1])) as { exp: number };
        const msUntilExpiry = payload.exp * 1000 - Date.now();
        if (msUntilExpiry <= 0) { logout(); return; }
        const timer = setTimeout(() => {
            if (isTokenExpired(session.accessToken)) logout();
        }, msUntilExpiry);
        return () => { clearTimeout(timer); };
    }, [session, logout]);

    const value = useMemo<AuthContextValue>(() => ({
        user: session?.user ?? null,
        isAuthenticated: session !== null,
        hasRole: (roles) => Boolean(session && roles.includes(session.user.role)),
        login,
        logout,
    }), [session, login, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
