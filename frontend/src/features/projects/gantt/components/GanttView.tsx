import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Moon, Sun, GanttChartSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhases } from "../../hooks/use-phases";
import { useNodes } from "../../hooks/use-nodes";
import { useProjectTasks } from "../../hooks/use-tasks";
import { computeRange, barMetrics, dayOffsetPct } from "../timeline";
import { STATUS_BAR_COLOR } from "../types";
import { TASK_STATUS_LABELS } from "../../types/labels";
import type { Project, Task } from "../../types/api.types";
import { TaskDetailPanel } from "./TaskDetailPanel";

const PHASE_ACCENTS = [
  "border-l-blue-400",
  "border-l-violet-400",
  "border-l-emerald-400",
  "border-l-amber-400",
  "border-l-rose-400",
];

interface PhaseGroup {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
}

const TODAY = new Date().toISOString().slice(0, 10);

function isOverdue(task: Task): boolean {
  return task.status !== "completada" && task.status !== "cancelada" && task.due_date < TODAY;
}

export function GanttView({
  project,
  dark,
  onToggleDark,
}: {
  project: Project;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const navigate = useNavigate();
  const phasesQuery = usePhases(project.id);
  const nodesQuery = useNodes(project.id);
  const tasksQuery = useProjectTasks(project.id);
  const [selected, setSelected] = useState<Task | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const range = useMemo(() => computeRange(tasks), [tasks]);
  const todayPct = range ? dayOffsetPct(TODAY, range) : null;

  // node_id → phase_id, para ubicar las tareas de nodo en su fase.
  const nodePhase = useMemo(() => {
    const map = new Map<string, string | null>();
    (nodesQuery.data ?? []).forEach((n) => map.set(n.id, n.phase_id));
    return map;
  }, [nodesQuery.data]);

  const groups = useMemo<PhaseGroup[]>(() => {
    const phases = phasesQuery.data ?? [];
    const byPhase = new Map<string, Task[]>();
    const noPhase: Task[] = [];
    for (const task of tasks) {
      const phaseId = task.phase_id ?? (task.node_id ? nodePhase.get(task.node_id) : null);
      if (phaseId) {
        const arr = byPhase.get(phaseId) ?? [];
        arr.push(task);
        byPhase.set(phaseId, arr);
      } else {
        noPhase.push(task);
      }
    }
    const result: PhaseGroup[] = phases
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((p) => ({
        id: p.id,
        name: p.name,
        order: p.order_index,
        tasks: byPhase.get(p.id) ?? [],
      }))
      .filter((g) => g.tasks.length > 0);
    if (noPhase.length > 0) {
      result.push({ id: "__none__", name: "Sin fase", order: 999, tasks: noPhase });
    }
    return result;
  }, [phasesQuery.data, tasks, nodePhase]);

  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-full lg:overflow-y-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${project.id}`)}
            className="mb-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← {project.name}
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            <GanttChartSquare className="size-5 text-blue-600" /> Cronograma
            {overdueCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                {overdueCount} vencida{overdueCount !== 1 ? "s" : ""}
              </span>
            )}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${project.id}/tareas`)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="size-4" /> Tarea
          </button>
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      {tasksQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : !range || groups.length === 0 ? (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          No hay tareas con fechas para mostrar en el cronograma. Crea tareas para verlas aquí.
        </p>
      ) : (
        <div className="relative flex flex-col gap-5">
          {/* Marcador de "hoy" */}
          {todayPct != null && (
            <div
              className="pointer-events-none absolute bottom-0 top-6 z-10 w-px bg-rose-400/70"
              style={{ left: `calc(160px + (100% - 160px) * ${todayPct / 100})` }}
            >
              <span className="absolute -top-5 -translate-x-1/2 rounded bg-rose-400 px-1 text-[9px] font-medium text-white">
                hoy
              </span>
            </div>
          )}

          {groups.map((group, gi) => (
            <section key={group.id}>
              <h2
                className={cn(
                  "mb-1.5 border-l-4 pl-2 text-sm font-semibold text-slate-700 dark:text-slate-200",
                  PHASE_ACCENTS[gi % PHASE_ACCENTS.length],
                )}
              >
                {group.order < 999 ? `Fase ${group.order + 1}: ` : ""}
                {group.name}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {group.tasks.length} tarea{group.tasks.length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="flex flex-col gap-1.5">
                {group.tasks.map((task) => {
                  const metrics = barMetrics(task, range);
                  const overdue = isOverdue(task);
                  return (
                    <div key={task.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                        {task.title}
                      </span>
                      <div className="relative h-6 flex-1 rounded bg-slate-50 dark:bg-slate-800/50">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(task);
                          }}
                          title={`${task.title} · ${task.start_date} → ${task.due_date} · ${TASK_STATUS_LABELS[task.status]}`}
                          className={cn(
                            "absolute top-0 h-6 rounded text-left transition hover:brightness-110",
                            STATUS_BAR_COLOR[task.status],
                            overdue &&
                              "ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-slate-900",
                          )}
                          style={{ left: `${metrics.offsetPct}%`, width: `${metrics.widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <TaskDetailPanel
          projectId={project.id}
          task={selected}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
