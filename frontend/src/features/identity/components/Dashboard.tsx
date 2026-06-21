import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { UserDashboardPage } from "@/features/dashboard/components/UserDashboardPage";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";

/**
 * Punto de entrada del dashboard. El rol User ve solo su información; los roles
 * administrativos ven el panorama global.
 */
export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === Role.USER) {
    return <UserDashboardPage />;
  }
  return <DashboardPage />;
}
