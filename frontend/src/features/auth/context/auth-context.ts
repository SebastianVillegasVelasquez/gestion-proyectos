import { createContext } from "react";
import type { AuthUser, Role } from "@/features/auth/types";
import type { Session } from "@/features/auth/utils/session.utils";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasRole: (roles: Role[]) => boolean;
  login: (session: Session) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
