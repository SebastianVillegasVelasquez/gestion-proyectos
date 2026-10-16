import { createContext } from "react";
import type { AuthUser, Role } from "@/features/auth/types";
import type { Session } from "@/features/auth/utils/session.utils";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Todavía se está averiguando si hay sesión (renovación silenciosa al
   *  arrancar). Los guards deben esperar, no redirigir al login. */
  isBootstrapping: boolean;
  /** Con una vista previa activa, `user.role` y `hasRole` ya hablan del rol
   *  previsualizado; el rol verdadero sigue en `realRole`. */
  hasRole: (roles: Role[]) => boolean;
  realRole: Role | null;
  viewAsRole: Role | null;
  /** Roles que el usuario real puede previsualizar (vacío = no puede). */
  previewableRoles: Role[];
  setViewAsRole: (role: Role | null) => void;
  login: (session: Session) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
