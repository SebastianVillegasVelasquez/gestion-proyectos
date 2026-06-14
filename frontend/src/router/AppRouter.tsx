import { Navigate, Route, Routes } from "react-router";
import LoginPage from "@/features/auth/components/Login.tsx";
import { AppLayout } from "@/components/layout/AppLayout.tsx";
import { Dashboard } from "@/features/identity/components/Dashboard.tsx";
import { ProjectBuilderPage } from "@/features/projects/components/ProjectBuilderPage.tsx";
import { AllProjectsPage } from "@/features/projects/components/AllProjectsPage.tsx";
import { ProjectDetailPage } from "@/features/projects/components/ProjectDetailPage.tsx";
import { TaskDashboardPage } from "@/features/projects/gantt/components/TaskDashboardPage.tsx";
import { WorkspacePage } from "@/features/workspace/components/WorkspacePage.tsx";
import { ProtectedRoute } from "@/router/ProtectedRoute.tsx";

export const AppRouter = () => (
  <Routes>
    {/* Rutas públicas */}
    <Route path="/login" element={<LoginPage />} />

    {/* Rutas protegidas — requieren sesión */}
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<AllProjectsPage />} />
        <Route path="/projects/builder" element={<ProjectBuilderPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/gantt" element={<TaskDashboardPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
