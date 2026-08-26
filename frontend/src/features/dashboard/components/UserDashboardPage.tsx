import { useOutletContext } from "react-router-dom";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { TaskBoard } from "./TaskBoard";
import { ProjectsPanel } from "./ProjectsPanel";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { MyTasksByProject } from "./MyTasksByProject";
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
  // Hoy en ISO local (no UTC): comparar vencimientos con `toISOString()` puede
  // adelantar o atrasar un día según la zona horaria.
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const panels = panelsQuery.data;
  const tasks = panels ? panels.task_board.map(toTask) : [];
  const projects = panels ? panels.projects.map(toProject) : [];
  const deadlines = panels ? panels.upcoming_deadlines.map((d) => toDeadline(d, today)) : [];

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      <DashboardHeader
        name={user?.name ?? "Usuario"}
        date={TODAY_FORMATTER.format(today)}
        tasksCompleted={summaryQuery.data?.completed_tasks}
        tasksTotal={summaryQuery.data?.total_tasks}
        dark={dark}
        onToggleDark={toggleDark}
      />

      <KpiCardsGrid
        cards={kpiCards}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-4">
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <TaskBoard tasks={tasks} />
        </div>
        {/* Lo que le toca hacer, proyecto por proyecto: el tablero de al lado
            cuenta el estado, esta tarjeta responde "¿por dónde empiezo?". */}
        <div className="flex min-h-0 flex-col lg:col-span-1">
          <MyTasksByProject tasks={panels?.task_board ?? []} today={todayIso} />
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
