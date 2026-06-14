import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";

export function ProtectedRoute() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
}
