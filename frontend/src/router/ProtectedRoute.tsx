import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { SpinnerScreen } from "@/components/common/Spinner";

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping } = useAuth();

  // Recargar con el access token vencido pero el refresh token vivo: la sesión
  // todavía no está en memoria, pero va a estar. Redirigir aquí mandaba al login
  // a gente con sesión válida, que además perdía la ruta en la que estaba.
  if (isBootstrapping) {
    return <SpinnerScreen label="Comprobando tu sesión" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
