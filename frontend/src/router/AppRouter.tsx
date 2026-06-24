import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
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
const ProjectProgressPage = lazy(() =>
  import("@/features/dashboard/components/ProjectProgressPage.tsx").then((m) => ({
    default: m.ProjectProgressPage,
  })),
);
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
const TeamDetailPage = lazy(() =>
  import("@/features/projects/components/TeamDetailPage.tsx").then((m) => ({
    default: m.TeamDetailPage,
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
const CollaboratorsPage = lazy(() =>
  import("@/features/collaborators/components/CollaboratorsPage.tsx").then((m) => ({
    default: m.CollaboratorsPage,
  })),
);
const CollaboratorActivityPage = lazy(() =>
  import("@/features/collaborators/components/CollaboratorActivityPage.tsx").then((m) => ({
    default: m.CollaboratorActivityPage,
  })),
);

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

export const AppRouter = () => (
  <Routes>
    {/* Rutas públicas */}
    <Route path="/login" element={<LoginPage />} />

    {/* Rutas protegidas — requieren sesión */}
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        {/* Accesibles a todos los roles */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Progreso de proyecto (solo lectura) — el backend valida membresía */}
        <Route path="/proyectos/:projectId/progreso" element={<ProjectProgressPage />} />

        {/* Solo administración: gestión global de proyectos y colaboradores */}
        <Route element={<RoleGuard roles={ADMIN_ROLES} />}>
          <Route path="/projects" element={<AllProjectsPage />} />
          <Route path="/projects/builder" element={<CreateProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/tareas" element={<TasksPage />} />
          <Route path="/projects/:projectId/gantt" element={<TaskDashboardPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="/collaborators" element={<CollaboratorsPage />} />
          <Route path="/collaborators/:userId" element={<CollaboratorActivityPage />} />
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
