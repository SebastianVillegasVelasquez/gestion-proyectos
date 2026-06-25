import { useOutletContext } from "react-router-dom";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { TaskBoard } from "./TaskBoard";
import { ProjectsPanel } from "./ProjectsPanel";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { useMyDashboardPanels, useMyDashboardSummary } from "../hooks/use-dashboard-summary";
import { buildMyKpiCards } from "../utils/build-kpi-cards";
import { toTask, toProject, toDeadline } from "../utils/transform-panels";
import { useAuth } from "@/features/auth/hooks/use-auth";

const TODAY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Fecha local en formato YYYY-MM-DD (sin saltos de zona horaria). */
function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dashboard del rol User: misma estructura visual que el de administrador, pero
 * solo con SU información (sus tareas, sus proyectos y vencimientos), servida por
 * los endpoints /dashboard/me/*. No muestra datos globales.
 */
export function UserDashboardPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { user } = useAuth();
  const summaryQuery = useMyDashboardSummary();
  const panelsQuery = useMyDashboardPanels();
  const kpiCards = summaryQuery.data ? buildMyKpiCards(summaryQuery.data) : [];

  const today = new Date();
  const todayISO = localISO(today);
  const panels = panelsQuery.data;
  const tasks = panels ? panels.task_board.map(toTask) : [];
  const projects = panels ? panels.projects.map(toProject) : [];
  const deadlines = panels ? panels.upcoming_deadlines.map((d) => toDeadline(d, today)) : [];

  const dueToday = panels
    ? panels.upcoming_deadlines.filter((d) => d.due_date === todayISO).length
    : 0;

  const headerData = {
    name: user?.name ?? "Usuario",
    date: TODAY_FORMATTER.format(today),
    tasksToday: dueToday,
    // Evita división por cero en la barra de progreso del encabezado.
    tasksTodayTotal: Math.max(summaryQuery.data?.total_tasks ?? 0, 1),
  };

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      <DashboardHeader {...headerData} dark={dark} onToggleDark={toggleDark} />

      <KpiCardsGrid
        cards={kpiCards}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-4">
        <div className="flex min-h-0 flex-col lg:col-span-3">
          <TaskBoard tasks={tasks} />
        </div>
        <div className="flex min-h-0 flex-col lg:col-span-1">
          <ProjectsPanel
            projects={projects}
            getProjectHref={(p) => `/proyectos/${p.id}/progreso`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:shrink-0">
        <UpcomingDeadlines deadlines={deadlines} />
      </div>
    </div>
  );
}
