import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Moon,
  Sun,
  GanttChartSquare,
  Plus,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkTree } from "../../hooks/use-structure";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { computeRange, barMetrics, dayOffsetPct, axisTicks } from "../timeline";
import { statusProgressPct, isOverdue, summarize, daysRemaining } from "../metrics";
import { filterGanttTasks, type GanttFilters } from "../filters";
import { STATUS_BAR_COLOR, STATUS_BAR_SOFT, STATUS_DOT } from "../types";
import { TASK_STATUS_LABELS } from "../../types/labels";
import type { Project, Task, TaskStatus } from "../../types/api.types";
import { TaskDetailPanel } from "./TaskDetailPanel";

// Ancho de la columna de etiquetas. Una sola fuente de verdad.
const LABEL_W = 184;
// Ancho mínimo del área de tiempo, para que proyectos cortos no se aplasten.
const MIN_TRACK = 360;

// Niveles de zoom en px por día. Definen el ancho del área de tiempo.
const ZOOM_PX = { mes: 5, semana: 14, dia: 34 } as const;
type Zoom = keyof typeof ZOOM_PX;
const ZOOM_LABELS: Record<Zoom, string> = { mes: "Mes", semana: "Semana", dia: "Día" };

const GROUP_ACCENTS = [
  "border-l-blue-400",
  "border-l-violet-400",
  "border-l-emerald-400",
  "border-l-amber-400",
  "border-l-rose-400",
];

// Fondo tenue por nodo, para agrupar visualmente las filas de cada banda.
const GROUP_BG = [
  "bg-blue-500/[0.04]",
  "bg-violet-500/[0.04]",
  "bg-emerald-500/[0.04]",
  "bg-amber-500/[0.04]",
  "bg-rose-500/[0.04]",
];

const LEGEND_STATUSES: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

interface NodeGroup {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
}

const TODAY = new Date().toISOString().slice(0, 10);

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  children,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)}>
            <Icon className="size-4" />
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{label}</span>
        </div>
        <span className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">
          {value}
        </span>
        {children}
      </CardContent>
    </Card>
  );
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
  const treeQuery = useWorkTree(project.id);
  const tasksQuery = useProjectTasks(project.id);
  const membersQuery = useProjectMembers(project.id);
  const [selected, setSelected] = useState<Task | null>(null);

  // Estado de filtros y zoom.
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [statuses, setStatuses] = useState<Set<TaskStatus>>(() => new Set(LEGEND_STATUSES));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filters: GanttFilters = useMemo(
    () => ({ statuses, assigneeId, onlyAtRisk }),
    [statuses, assigneeId, onlyAtRisk],
  );
  const tasks = useMemo(() => filterGanttTasks(allTasks, filters, TODAY), [allTasks, filters]);

  const range = useMemo(() => computeRange(tasks), [tasks]);
  const todayPct = range ? dayOffsetPct(TODAY, range) : null;
  const ticks = useMemo(() => (range ? axisTicks(range) : []), [range]);
  const summary = useMemo(() => summarize(tasks, TODAY), [tasks]);
  const remaining = daysRemaining(project.end_date, TODAY);

  const trackWidth = range ? Math.max(MIN_TRACK, range.totalDays * ZOOM_PX[zoom]) : MIN_TRACK;
  // Posición absoluta (px) de un % del rango dentro del cuerpo (tras la columna).
  const xOf = (offsetPct: number) => LABEL_W + (offsetPct / 100) * trackWidth;

  // assignee_id → iniciales/nombre, para el responsable de cada fila.
  const assignees = useMemo(() => {
    const map = new Map<string, { initials: string; name: string }>();
    (membersQuery.data ?? []).forEach((m) => {
      const initials = (m.name.charAt(0) + m.last_name.charAt(0)).toUpperCase() || "?";
      map.set(m.user_id, { initials, name: `${m.name} ${m.last_name}` });
    });
    return map;
  }, [membersQuery.data]);

  // Mapa work_item_id → nombre, y su orden de aparición en el árbol (DFS), para
  // agrupar las filas del Gantt por el nodo del que cuelga cada tarea.
  const itemMeta = useMemo(() => {
    const map = new Map<string, { name: string; order: number }>();
    let order = 0;
    const walk = (nodes: typeof treeQuery.data) => {
      (nodes ?? []).forEach((n) => {
        map.set(n.id, { name: n.nombre, order: order++ });
        walk(n.children);
      });
    };
    walk(treeQuery.data);
    return map;
  }, [treeQuery.data]);

  const groups = useMemo<NodeGroup[]>(() => {
    const byItem = new Map<string, Task[]>();
    for (const task of tasks) {
      const arr = byItem.get(task.work_item_id) ?? [];
      arr.push(task);
      byItem.set(task.work_item_id, arr);
    }
    return Array.from(byItem.entries())
      .map(([id, items]) => ({
        id,
        name: itemMeta.get(id)?.name ?? "Sin nodo",
        order: itemMeta.get(id)?.order ?? 999,
        tasks: items,
      }))
      .sort((a, b) => a.order - b.order);
  }, [tasks, itemMeta]);

  const toggleStatus = (s: TaskStatus) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  const remainingText =
    remaining == null
      ? "—"
      : remaining < 0
        ? `${Math.abs(remaining)} d de retraso`
        : `${remaining} d`;

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-gold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

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
            <GanttChartSquare className="size-5 text-brand-teal" /> Cronograma
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${project.id}/tareas`)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
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

      {/* Franja de KPIs (se ajusta a los filtros activos) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={TrendingUp}
          label="Avance"
          value={`${summary.progressPct}%`}
          tone="bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal"
        >
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-gold transition-all"
              style={{ width: `${summary.progressPct}%` }}
            />
          </div>
        </KpiCard>
        <KpiCard
          icon={CheckCircle2}
          label="Completadas"
          value={`${summary.completed}/${summary.total}`}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
        />
        <KpiCard
          icon={Loader2}
          label="En progreso"
          value={String(summary.inProgress)}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Vencidas"
          value={String(summary.overdue)}
          tone={
            summary.overdue > 0
              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }
        />
        <KpiCard
          icon={CalendarClock}
          label="Cierre"
          value={remainingText}
          tone={
            remaining != null && remaining < 0
              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
              : "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
          }
        />
      </div>

      {/* Barra de filtros y zoom */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Leyenda interactiva = filtro por estado */}
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGEND_STATUSES.map((s) => {
            const active = statuses.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  toggleStatus(s);
                }}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition",
                  active
                    ? "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    : "border-transparent text-slate-300 line-through dark:text-slate-600",
                )}
              >
                <span
                  className={cn("size-2 rounded-full", STATUS_DOT[s], !active && "opacity-40")}
                />
                {TASK_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Responsable */}
          <select
            className={inputCls}
            value={assigneeId ?? ""}
            onChange={(e) => {
              setAssigneeId(e.target.value || null);
            }}
            aria-label="Filtrar por responsable"
          >
            <option value="">Todos los responsables</option>
            {(membersQuery.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name} {m.last_name}
              </option>
            ))}
          </select>

          {/* Solo en riesgo */}
          <button
            type="button"
            onClick={() => {
              setOnlyAtRisk((v) => !v);
            }}
            aria-pressed={onlyAtRisk}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
              onlyAtRisk
                ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                : "border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400",
            )}
          >
            <AlertTriangle className="size-3.5" /> Solo en riesgo
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(Object.keys(ZOOM_PX) as Zoom[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => {
                  setZoom(z);
                }}
                aria-pressed={zoom === z}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition",
                  zoom === z
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                {ZOOM_LABELS[z]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : allTasks.length === 0 ? (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          No hay tareas con fechas para mostrar en el cronograma. Crea tareas para verlas aquí.
        </p>
      ) : !range || groups.length === 0 ? (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          No hay tareas que coincidan con los filtros.
        </p>
      ) : (
        // Contenedor con scroll horizontal: la columna de etiquetas queda fija.
        <div className="overflow-x-auto pb-2">
          <div style={{ width: LABEL_W + trackWidth }}>
            {/* Eje de tiempo */}
            <div className="flex items-end">
              <div
                style={{ width: LABEL_W }}
                className="sticky left-0 z-20 shrink-0 bg-white dark:bg-slate-950"
              />
              <div className="relative h-5" style={{ width: trackWidth }}>
                {ticks.map((t) => (
                  <span
                    key={t.key}
                    className={cn(
                      "absolute top-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-500",
                      t.offsetPct > 0 && "-translate-x-1/2",
                    )}
                    style={{ left: `${(t.offsetPct / 100) * trackWidth}px` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Cuerpo: rejilla, hoy y filas */}
            <div
              className="relative flex flex-col gap-5 pt-1"
              style={{ width: LABEL_W + trackWidth }}
            >
              {ticks.map((t) => (
                <div
                  key={`grid-${t.key}`}
                  className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-slate-100 dark:bg-slate-800/70"
                  style={{ left: `${xOf(t.offsetPct)}px` }}
                />
              ))}

              {todayPct != null && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-400"
                  style={{ left: `${xOf(todayPct)}px` }}
                >
                  <span className="absolute -top-1 -translate-x-1/2 rounded bg-rose-400 px-1 text-[9px] font-medium text-white">
                    hoy
                  </span>
                </div>
              )}

              {groups.map((group, gi) => (
                <section
                  key={group.id}
                  className={cn("rounded-lg", GROUP_BG[gi % GROUP_BG.length])}
                >
                  <h2
                    className={cn(
                      "sticky left-0 z-20 mb-1.5 inline-block rounded-r border-l-4 bg-white py-0.5 pl-2 pr-2 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200",
                      GROUP_ACCENTS[gi % GROUP_ACCENTS.length],
                    )}
                  >
                    {group.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {group.tasks.length} tarea{group.tasks.length !== 1 ? "s" : ""}
                    </span>
                  </h2>
                  <div className="flex flex-col gap-1.5 pb-1">
                    {group.tasks.map((task) => {
                      const metrics = barMetrics(task, range);
                      const overdue = isOverdue(task, TODAY);
                      const progress = statusProgressPct(task.status);
                      const assignee = task.assignee_id ? assignees.get(task.assignee_id) : null;
                      return (
                        <div key={task.id} className="flex items-center gap-3">
                          <div
                            style={{ width: LABEL_W }}
                            className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 bg-white dark:bg-slate-950"
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                STATUS_DOT[task.status],
                              )}
                            />
                            <span className="flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                              {task.title}
                            </span>
                            <span
                              title={assignee?.name ?? "Sin responsable"}
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                                assignee
                                  ? "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                              )}
                            >
                              {assignee?.initials ?? "—"}
                            </span>
                          </div>
                          <div className="relative h-6 shrink-0" style={{ width: trackWidth }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(task);
                              }}
                              title={[
                                task.title,
                                assignee?.name ?? "Sin responsable",
                                `${task.start_date} → ${task.due_date}`,
                                `${TASK_STATUS_LABELS[task.status]} · ${progress}%`,
                              ].join("\n")}
                              className={cn(
                                "absolute top-0 h-6 overflow-hidden rounded text-left transition hover:brightness-105",
                                STATUS_BAR_SOFT[task.status],
                                overdue &&
                                  "ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-slate-900",
                              )}
                              style={{
                                left: `${(metrics.offsetPct / 100) * trackWidth}px`,
                                width: `${(metrics.widthPct / 100) * trackWidth}px`,
                              }}
                            >
                              <span
                                className={cn(
                                  "block h-full rounded",
                                  STATUS_BAR_COLOR[task.status],
                                )}
                                style={{ width: `${progress}%` }}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
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
