import { lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import LoginPage from "@/features/auth/components/Login.tsx";
import { AppLayout } from "@/components/layout/AppLayout.tsx";
import { ProtectedRoute } from "@/router/ProtectedRoute.tsx";
import { RoleGuard } from "@/router/RoleGuard.tsx";
import { Role } from "@/features/auth/types";

// Code-splitting: la app autenticada se carga por demanda (al navegar a cada
// ruta), no al abrir el login. Cada chunk se descarga la primera vez que se
// visita su ruta. `LoginPage` queda eager porque es la pantalla inicial.
const Dashboard = lazy(() =>
  import("@/features/identity/components/Dashboard.tsx").then((m) => ({ default: m.Dashboard })),
);
const WorkspacePage = lazy(() =>
  import("@/features/workspace/components/WorkspacePage.tsx").then((m) => ({
    default: m.WorkspacePage,
  })),
);
const SettingsPage = lazy(() => import("@/features/settings/components/SettingsPage.tsx"));
const FeedbackInbox = lazy(() => import("@/features/feedback/components/FeedbackInbox.tsx"));
const ClientPortal = lazy(() => import("@/features/client/components/ClientPortal.tsx"));
const ClientProjectPortal = lazy(
  () => import("@/features/client/components/ClientProjectPortal.tsx"),
);
const AdminUsersPage = lazy(() => import("@/features/admin/components/AdminUsersPage.tsx"));
const ProjectProgressPage = lazy(() =>
  import("@/features/dashboard/components/ProjectProgressPage.tsx").then((m) => ({
    default: m.ProjectProgressPage,
  })),
);
const MyProjectsPage = lazy(() =>
  import("@/features/dashboard/components/MyProjectsPage.tsx").then((m) => ({
    default: m.MyProjectsPage,
  })),
);
// "Equipos de trabajo" de un proyecto y "Espacios de trabajo" son la misma cosa:
// las rutas por proyecto redirigen al espacio de trabajo con el equipo elegido.
function RedirectTeamToWorkspace() {
  const { teamId } = useParams<{ teamId?: string }>();
  return <Navigate to={teamId ? `/workspace?team=${teamId}` : "/workspace"} replace />;
}
const AllProjectsPage = lazy(() =>
  import("@/features/projects/components/AllProjectsPage.tsx").then((m) => ({
    default: m.AllProjectsPage,
  })),
);
const CreateProjectPage = lazy(() =>
  import("@/features/projects/components/CreateProjectPage.tsx").then((m) => ({
    default: m.CreateProjectPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("@/features/projects/components/ProjectDetailPage.tsx").then((m) => ({
    default: m.ProjectDetailPage,
  })),
);
const TaskDashboardPage = lazy(() =>
  import("@/features/projects/gantt/components/TaskDashboardPage.tsx").then((m) => ({
    default: m.TaskDashboardPage,
  })),
);
const TasksPage = lazy(() =>
  import("@/features/projects/tasks/TasksPage.tsx").then((m) => ({ default: m.TasksPage })),
);
const ProjectReportPage = lazy(() =>
  import("@/features/reports/components/ProjectReportPage.tsx").then((m) => ({
    default: m.ProjectReportPage,
  })),
);
const ProjectEstructuraPage = lazy(() =>
  import("@/features/projects/components/detail/ProjectEstructuraPage.tsx").then((m) => ({
    default: m.ProjectEstructuraPage,
  })),
);
const ProjectIntegrantesPage = lazy(() =>
  import("@/features/projects/components/detail/ProjectIntegrantesPage.tsx").then((m) => ({
    default: m.ProjectIntegrantesPage,
  })),
);
const ProjectEquiposPage = lazy(() =>
  import("@/features/projects/components/detail/ProjectEquiposPage.tsx").then((m) => ({
    default: m.ProjectEquiposPage,
  })),
);
const ProjectTrazabilidadPage = lazy(() =>
  import("@/features/projects/components/detail/ProjectTrazabilidadPage.tsx").then((m) => ({
    default: m.ProjectTrazabilidadPage,
  })),
);

// developer también administra usuarios/cargos (ver MANAGEMENT_ROLES en el
// backend: admin/super_admin/developer crean cuentas, ya no hay registro público).
const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER];

export const AppRouter = () => (
  <Routes>
    {/* Rutas públicas */}
    <Route path="/login" element={<LoginPage />} />
    {/* Portal del cliente: pantalla pública única, sin sesión. El token NO viaja
        en la URL: el cliente lo introduce en la pantalla y se envía por POST
        (validado en el backend). Enlace y token se entregan por separado. */}
    <Route path="/portal/entrar" element={<ClientProjectPortal />} />

    {/* Rutas protegidas — requieren sesión */}
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        {/* Accesibles a todos los roles */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Portal del cliente (pantalla única de solo lectura). */}
        <Route path="/portal" element={<ClientPortal />} />

        {/* Bandeja de feedback: solo el rol técnico (developer). */}
        <Route element={<RoleGuard roles={[Role.DEVELOPER]} />}>
          <Route path="/feedback" element={<FeedbackInbox />} />
        </Route>
        {/* Vistas del rol User acotadas por membresía (el backend valida el
            acceso; no van dentro del RoleGuard de administración). */}
        <Route path="/mis-proyectos" element={<MyProjectsPage />} />
        <Route path="/proyectos/:projectId/progreso" element={<ProjectProgressPage />} />
        <Route path="/proyectos/:projectId/equipos" element={<RedirectTeamToWorkspace />} />
        <Route path="/proyectos/:projectId/equipos/:teamId" element={<RedirectTeamToWorkspace />} />

        {/* Solo administración: gestión global de proyectos y colaboradores */}
        <Route element={<RoleGuard roles={ADMIN_ROLES} />}>
          <Route path="/projects" element={<AllProjectsPage />} />
          <Route path="/projects/builder" element={<CreateProjectPage />} />
          {/* Detalle del proyecto = vista principal. Cada sección vive en su
              propia pantalla independiente (con botón para volver al detalle),
              ya no como pestañas embebidas dentro del detalle. */}
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/estructura" element={<ProjectEstructuraPage />} />
          <Route path="/projects/:projectId/integrantes" element={<ProjectIntegrantesPage />} />
          <Route path="/projects/:projectId/equipos" element={<ProjectEquiposPage />} />
          <Route path="/projects/:projectId/trazabilidad" element={<ProjectTrazabilidadPage />} />
          <Route path="/projects/:projectId/tareas" element={<TasksPage />} />
          <Route path="/projects/:projectId/gantt" element={<TaskDashboardPage />} />
          <Route path="/projects/:projectId/analiticas" element={<ProjectReportPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
