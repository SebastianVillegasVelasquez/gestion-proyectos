import type { AuthUser } from "@/features/auth/types";
import { isTokenExpired } from "./jwt.utils";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const USER_KEY = "auth_user";

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser;
}

export function readSession(): Session | null {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  if (!accessToken || !userJson) {
    return null;
  }
  if (isTokenExpired(accessToken)) {
    return null;
  }
  try {
    return {
      accessToken,
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: JSON.parse(userJson) as AuthUser,
    };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  if (session.refreshToken) {
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
