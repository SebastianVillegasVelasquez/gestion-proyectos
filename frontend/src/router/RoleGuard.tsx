import { Navigate, Outlet, useOutletContext } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { Role } from "@/features/auth/types";

interface RoleGuardProps {
  roles: Role[];
  redirectTo?: string;
}

export function RoleGuard({ roles, redirectTo = "/dashboard" }: RoleGuardProps) {
  const { hasRole } = useAuth();
  // Reenviar el contexto del Outlet padre (AppLayout provee { dark, toggleDark }).
  // Sin esto, las páginas hijas que usan useOutletContext() recibirían undefined
  // y romperían al desestructurar (pantalla en blanco).
  const context = useOutletContext();
  if (!hasRole(roles)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Outlet context={context} />;
}
