import { useOutletContext } from "react-router-dom";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { TaskBoard } from "./TaskBoard";
import { ProjectsPanel } from "./ProjectsPanel";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { CommentsPanel } from "./CommentsPanel";
import { useDashboardPanels, useDashboardSummary } from "../hooks/use-dashboard-summary";
import { buildKpiCards } from "../utils/build-kpi-cards";
import { toTask, toProject, toDeadline } from "../utils/transform-panels";
import { mockHeaderData, mockComments } from "../mockData";
import { useAuth } from "@/features/auth/hooks/use-auth";

const TODAY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function DashboardPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { user } = useAuth();
  const summaryQuery = useDashboardSummary();
  const panelsQuery = useDashboardPanels();
  const kpiCards = summaryQuery.data ? buildKpiCards(summaryQuery.data) : [];

  // El backend ya filtró/ordenó/acotó; aquí solo mapeamos a los view-models.
  const today = new Date();
  const panels = panelsQuery.data;
  const tasks = panels ? panels.task_board.map(toTask) : [];
  const projects = panels ? panels.projects.map(toProject) : [];
  const deadlines = panels ? panels.upcoming_deadlines.map((d) => toDeadline(d, today)) : [];

  const headerData = {
    ...mockHeaderData,
    name: user?.name ?? "Usuario",
    date: TODAY_FORMATTER.format(today),
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
          <ProjectsPanel projects={projects} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:shrink-0">
        <UpcomingDeadlines deadlines={deadlines} />
        <CommentsPanel comments={mockComments} />
      </div>
    </div>
  );
}
