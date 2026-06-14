import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { Role } from "@/features/auth/types";

interface RoleGuardProps {
    roles: Role[];
    redirectTo?: string;
}

export function RoleGuard({ roles, redirectTo = "/dashboard" }: RoleGuardProps) {
    const { hasRole } = useAuth();
    if (!hasRole(roles)) return <Navigate to={redirectTo} replace />;
    return <Outlet />;
}
