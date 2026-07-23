import { useMemo } from "react";
import { useNavigate } from "react-router";
import { GanttChartSquare, ListChecks, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkTree } from "../../hooks/use-structure";
import { useProjectTasks } from "../../hooks/use-tasks";
import type { TaskStatus, WorkItemTree } from "../../types/api.types";

const PENDING_STATUSES: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
];

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) {
    return null;
  }
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) {
    return null;
  }
  return Math.round((b - a) / 86400000) + 1;
}

function projectSpan(tree: WorkItemTree[]): number | null {
  let min: string | null = null;
  let max: string | null = null;
  const visit = (node: WorkItemTree) => {
    if (node.fecha_inicio_plan && (!min || node.fecha_inicio_plan < min)) {
      min = node.fecha_inicio_plan;
    }
    if (node.fecha_fin_plan && (!max || node.fecha_fin_plan > max)) {
      max = node.fecha_fin_plan;
    }
    node.children.forEach(visit);
  };
  tree.forEach(visit);
  return daysBetween(min, max);
}

function ActionCard({
  title,
  subtitle,
  icon,
  stats,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  stats: { label: string; dotClass: string }[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-card px-6 py-5 text-left transition-all hover:border-brand-blue/40 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground transition-colors group-hover:bg-brand-blue group-hover:text-white">
          <ArrowRight className="size-4" />
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-accent/60 pt-3 text-[13px] font-semibold text-muted-foreground">
        {stats.length === 0 ? (
          <span className="text-xs italic text-muted-foreground/70">Sin datos aún</span>
        ) : (
          stats.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", s.dotClass)} />
              {s.label}
            </span>
          ))
        )}
      </div>
    </button>
  );
}

export function ProjectActions({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const treeQuery = useWorkTree(projectId);
  const tasksQuery = useProjectTasks(projectId);

  const timelineStats = useMemo(() => {
    const tree = treeQuery.data ?? [];
    if (tree.length === 0) {
      return [];
    }
    const fases = tree.length;
    const dias = projectSpan(tree);
    const stats = [{ label: `${fases} fase${fases === 1 ? "" : "s"}`, dotClass: "bg-brand-blue" }];
    if (dias != null) {
      stats.push({
        label: `${dias} día${dias === 1 ? "" : "s"}`,
        dotClass: "bg-muted-foreground/50",
      });
    }
    return stats;
  }, [treeQuery.data]);

  const taskStats = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    if (tasks.length === 0) {
      return [];
    }
    const total = tasks.length;
    const pendientes = tasks.filter((t) => PENDING_STATUSES.includes(t.status)).length;
    return [
      { label: `${total} tarea${total === 1 ? "" : "s"}`, dotClass: "bg-brand-blue" },
      {
        label: `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`,
        dotClass: "bg-rose-500/70",
      },
    ];
  }, [tasksQuery.data]);

  return (
    <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <ActionCard
        title="Cronograma"
        subtitle="Línea de tiempo por fases"
        icon={<GanttChartSquare className="size-5" />}
        stats={timelineStats}
        onClick={() => void navigate(`/projects/${projectId}/gantt`)}
      />
      <ActionCard
        title="Tareas"
        subtitle="Crea, asigna y da seguimiento"
        icon={<ListChecks className="size-5" />}
        stats={taskStats}
        onClick={() => void navigate(`/projects/${projectId}/tareas`)}
      />
    </div>
  );
}
