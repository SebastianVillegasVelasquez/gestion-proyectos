import { useOutletContext } from "react-router-dom";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { TaskBoard } from "./TaskBoard";
import { ProjectsPanel } from "./ProjectsPanel";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { CommentsPanel } from "./CommentsPanel";
import { useDashboardSummary } from "../hooks/use-dashboard-summary";
import { buildKpiCards } from "../utils/build-kpi-cards";
import { mockHeaderData, mockTasks, mockProjects, mockDeadlines, mockComments } from "../mockData";

export function DashboardPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const summaryQuery = useDashboardSummary();
  const kpiCards = summaryQuery.data ? buildKpiCards(summaryQuery.data) : [];

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      <DashboardHeader {...mockHeaderData} dark={dark} onToggleDark={toggleDark} />

      <KpiCardsGrid
        cards={kpiCards}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
      />

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:flex-1 lg:grid-cols-4">
        <div className="flex min-h-0 flex-col lg:col-span-3">
          <TaskBoard tasks={mockTasks} />
        </div>
        <div className="flex min-h-0 flex-col lg:col-span-1">
          <ProjectsPanel projects={mockProjects} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:shrink-0">
        <UpcomingDeadlines deadlines={mockDeadlines} />
        <CommentsPanel comments={mockComments} />
      </div>
    </div>
  );
}
