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
    // Alto fijo (sin desplazamiento de página) solo a partir de xl, que es donde
    // los tres paneles caben de verdad uno al lado del otro. En lg lo hacía
    // igual y el contenido que sobraba —los vencimientos al desplegar "ver
    // más"— quedaba recortado y sin forma de alcanzarlo.
    <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-5 xl:h-full xl:overflow-hidden">
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

      {/* Un fallo al traer los paneles no puede leerse como "no tienes nada":
          los estados vacíos de las tarjetas dirían justo eso. */}
      {panelsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          No se pudieron cargar tus tareas y proyectos. Intenta recargar la página.
        </div>
      )}

      {/* En lg se repartía en 4 columnas y el tablero (que a su vez tiene tres
          columnas dentro) quedaba en ~250 px por columna. Ahora en lg son dos
          filas de dos y solo en xl se abre a cuatro. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-4">
        <div className="flex min-h-[280px] flex-col lg:col-span-2 xl:min-h-0">
          <TaskBoard tasks={tasks} />
        </div>
        {/* Lo que le toca hacer, proyecto por proyecto: el tablero de al lado
            cuenta el estado, esta tarjeta responde "¿por dónde empiezo?". */}
        <div className="flex min-h-[280px] flex-col xl:min-h-0">
          <MyTasksByProject tasks={panels?.task_board ?? []} today={todayIso} />
        </div>
        <div className="flex min-h-[280px] flex-col xl:min-h-0">
          <ProjectsPanel
            projects={projects}
            getProjectHref={(p) => `/proyectos/${p.id}/progreso`}
          />
        </div>
      </div>

      <div className="shrink-0">
        <UpcomingDeadlines
          deadlines={deadlines}
          deliveredLast7d={summaryQuery.data?.delivered_last_7d}
        />
      </div>
    </div>
  );
}
