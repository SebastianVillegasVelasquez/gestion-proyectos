import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkTree } from "../../hooks/use-structure";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import {
  computeRange,
  padRange,
  barMetrics,
  dayOffsetPct,
  ticksForZoom,
  monthBands,
  weekendBands,
  toDayNumber,
  shortDate,
  type TickUnit,
} from "../timeline";
import { statusProgressPct, isOverdue, summarize, daysRemaining } from "../metrics";
import { filterGanttTasks, type GanttFilters } from "../filters";
import { STATUS_BAR_COLOR, STATUS_BAR_SOFT, STATUS_DOT } from "../types";
import { TASK_STATUS_LABELS } from "../../types/labels";
import type { Project, Task, TaskStatus } from "../../types/api.types";
import { TaskDetailPanel } from "./TaskDetailPanel";

// Ancho de la columna de etiquetas. Una sola fuente de verdad.
const LABEL_W = 224;
// Ancho mínimo del área de tiempo, para que proyectos cortos no se aplasten.
const MIN_TRACK = 480;
// Alto de cada fila (tarea y encabezado de grupo).
const ROW_H = 36;

// Configuración por nivel de zoom: px por día y unidad natural de las marcas.
const ZOOM_CFG: Record<"mes" | "semana" | "dia", { px: number; unit: TickUnit; label: string }> = {
  mes: { px: 6, unit: "month", label: "Mes" },
  semana: { px: 16, unit: "week", label: "Semana" },
  dia: { px: 36, unit: "day", label: "Día" },
};
type Zoom = keyof typeof ZOOM_CFG;

// Acento visual por grupo (borde de la etiqueta + barra agregada del nodo).
const GROUP_TONES = [
  { accent: "border-l-blue-400", bar: "bg-blue-400/50 dark:bg-blue-400/40" },
  { accent: "border-l-violet-400", bar: "bg-violet-400/50 dark:bg-violet-400/40" },
  { accent: "border-l-emerald-400", bar: "bg-emerald-400/50 dark:bg-emerald-400/40" },
  { accent: "border-l-amber-400", bar: "bg-amber-400/50 dark:bg-amber-400/40" },
  { accent: "border-l-rose-400", bar: "bg-rose-400/50 dark:bg-rose-400/40" },
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

  // Estado de filtros, zoom y grupos colapsados.
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [statuses, setStatuses] = useState<Set<TaskStatus>>(() => new Set(LEGEND_STATUSES));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const filters: GanttFilters = useMemo(
    () => ({ statuses, assigneeId, onlyAtRisk }),
    [statuses, assigneeId, onlyAtRisk],
  );
  const tasks = useMemo(() => filterGanttTasks(allTasks, filters, TODAY), [allTasks, filters]);

  // El rango se calcula sobre TODAS las tareas (no las filtradas): así el eje
  // de tiempo es estable y filtrar no "salta" la escala. Se le agrega aire en
  // ambos extremos para que ninguna barra toque el borde del área.
  const range = useMemo(() => {
    const raw = computeRange(allTasks);
    if (!raw) {
      return null;
    }
    const pad = Math.min(14, Math.max(2, Math.ceil(raw.totalDays * 0.04)));
    return padRange(raw, pad, pad + 1);
  }, [allTasks]);

  const todayPct = range ? dayOffsetPct(TODAY, range) : null;
  const ticks = useMemo(
    () => (range ? ticksForZoom(range, ZOOM_CFG[zoom].unit) : []),
    [range, zoom],
  );
  const months = useMemo(() => (range ? monthBands(range) : []), [range]);
  const weekends = useMemo(
    () => (range && zoom === "dia" ? weekendBands(range) : []),
    [range, zoom],
  );
  const summary = useMemo(() => summarize(tasks, TODAY), [tasks]);
  const remaining = daysRemaining(project.end_date, TODAY);

  const trackWidth = range ? Math.max(MIN_TRACK, range.totalDays * ZOOM_CFG[zoom].px) : MIN_TRACK;
  const pxPerDay = range ? trackWidth / range.totalDays : 0;
  const pctToPx = (pct: number) => (pct / 100) * trackWidth;

  // Scroll horizontal: centrar la línea de "hoy" en el área visible.
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrolledRef = useRef(false);
  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el || todayPct == null) {
        return;
      }
      const contentX = (todayPct / 100) * trackWidth;
      el.scrollTo({ left: contentX - (el.clientWidth - LABEL_W) / 2, behavior });
    },
    [todayPct, trackWidth],
  );
  useEffect(() => {
    if (!autoScrolledRef.current && todayPct != null && scrollRef.current) {
      autoScrolledRef.current = true;
      scrollToToday("auto");
    }
  }, [todayPct, scrollToToday]);

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
        name: itemMeta.get(id)?.name ?? "Sin ubicación",
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

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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

          {/* Ir a hoy */}
          <button
            type="button"
            onClick={() => {
              scrollToToday();
            }}
            disabled={todayPct == null}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title="Centrar el cronograma en la fecha actual"
          >
            <Crosshair className="size-3.5" /> Hoy
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(Object.keys(ZOOM_CFG) as Zoom[]).map((z) => (
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
                {ZOOM_CFG[z].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : allTasks.length === 0 || !range ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
          <GanttChartSquare className="size-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            No hay tareas con fechas para mostrar en el cronograma.
            <br />
            Crea tareas para verlas aquí.
          </p>
        </div>
      ) : (
        // Contenedor con scroll en ambos ejes: el eje de tiempo queda fijo
        // arriba y la columna de tareas fija a la izquierda.
        <div
          ref={scrollRef}
          className="relative max-h-[65vh] overflow-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="relative" style={{ width: LABEL_W + trackWidth, minWidth: "100%" }}>
            {/* ── Encabezado sticky: banda de meses + marcas del eje ── */}
            <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div
                style={{ width: LABEL_W }}
                className="sticky left-0 z-10 flex shrink-0 items-end border-r border-slate-200 bg-white px-3 pb-1.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tareas · {tasks.length}
                </span>
              </div>
              <div className="relative shrink-0" style={{ width: trackWidth }}>
                <div className="relative h-6">
                  {months.map((b) => (
                    <div
                      key={b.key}
                      className="absolute inset-y-0 flex items-center overflow-hidden border-l border-slate-200 pl-1.5 dark:border-slate-700"
                      style={{ left: pctToPx(b.startPct), width: pctToPx(b.widthPct) }}
                    >
                      {pctToPx(b.widthPct) >= 48 && (
                        <span className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {b.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="relative h-5 border-t border-slate-100 dark:border-slate-800/80">
                  {ticks.map((t) => {
                    if (t.offsetPct > 97) {
                      return null; // el rótulo no cabe: la línea de rejilla basta
                    }
                    // En zoom de día el rótulo se centra dentro de su celda;
                    // en semana/mes se ancla justo después de la marca.
                    const centered = zoom === "dia";
                    return (
                      <span
                        key={t.key}
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] tabular-nums text-slate-400 dark:text-slate-500",
                          centered && "-translate-x-1/2",
                        )}
                        style={{
                          left: pctToPx(t.offsetPct) + (centered ? pxPerDay / 2 : 4),
                        }}
                      >
                        {t.label}
                      </span>
                    );
                  })}
                  {todayPct != null && (
                    <span
                      className="absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-semibold leading-tight text-white shadow-sm"
                      style={{ left: pctToPx(todayPct) }}
                    >
                      Hoy
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Cuerpo ── */}
            <div className="relative">
              {/* Capa de fondo: fines de semana y rejilla, alineadas al eje */}
              <div
                className="pointer-events-none absolute inset-y-0 z-0"
                style={{ left: LABEL_W, width: trackWidth }}
              >
                {weekends.map((b) => (
                  <div
                    key={b.key}
                    className="absolute inset-y-0 bg-slate-100/70 dark:bg-slate-900/60"
                    style={{ left: pctToPx(b.startPct), width: pctToPx(b.widthPct) }}
                  />
                ))}
                {ticks.map((t) => (
                  <div
                    key={`grid-${t.key}`}
                    className="absolute inset-y-0 w-px bg-slate-100 dark:bg-slate-800/60"
                    style={{ left: pctToPx(t.offsetPct) }}
                  />
                ))}
                {months.slice(1).map((b) => (
                  <div
                    key={`mline-${b.key}`}
                    className="absolute inset-y-0 w-px bg-slate-200 dark:bg-slate-700/70"
                    style={{ left: pctToPx(b.startPct) }}
                  />
                ))}
              </div>

              {/* Línea de hoy (sobre las barras, bajo la columna fija) */}
              {todayPct != null && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-400/80"
                  style={{ left: LABEL_W + pctToPx(todayPct) }}
                />
              )}

              {groups.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="sticky left-0 px-4 text-sm italic text-slate-400 dark:text-slate-500">
                    No hay tareas que coincidan con los filtros.
                  </p>
                </div>
              ) : (
                groups.map((group, gi) => {
                  const tone = GROUP_TONES[gi % GROUP_TONES.length];
                  const isCollapsed = collapsedGroups.has(group.id);
                  const done = group.tasks.filter((t) => t.status === "completada").length;
                  // Rango agregado del grupo: de la primera fecha de inicio a
                  // la última entrega (las ISO se comparan como strings).
                  const gStart = group.tasks.reduce(
                    (acc, t) => (t.start_date < acc ? t.start_date : acc),
                    group.tasks[0].start_date,
                  );
                  const gEnd = group.tasks.reduce(
                    (acc, t) => (t.due_date > acc ? t.due_date : acc),
                    group.tasks[0].due_date,
                  );
                  const gm = barMetrics({ start_date: gStart, due_date: gEnd }, range);
                  return (
                    <section key={group.id}>
                      {/* Encabezado del grupo: clic = colapsar/expandir */}
                      <div
                        className="flex items-stretch border-b border-slate-100 dark:border-slate-800/70"
                        style={{ height: ROW_H }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            toggleGroup(group.id);
                          }}
                          aria-expanded={!isCollapsed}
                          style={{ width: LABEL_W }}
                          className={cn(
                            "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-l-[3px] border-r border-r-slate-200 bg-slate-50 px-2 text-left transition-colors hover:bg-slate-100 dark:border-r-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800",
                            tone.accent,
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "size-3.5 shrink-0 text-slate-400 transition-transform",
                              isCollapsed && "-rotate-90",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {group.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-white px-1.5 py-px text-[10px] font-medium tabular-nums text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                            {done}/{group.tasks.length}
                          </span>
                        </button>
                        <div className="relative flex-1 bg-slate-50/60 dark:bg-slate-900/40">
                          {/* Barra agregada del nodo (resumen del grupo) */}
                          <div
                            className={cn(
                              "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
                              tone.bar,
                            )}
                            style={{
                              left: pctToPx(gm.offsetPct),
                              width: Math.max(8, pctToPx(gm.widthPct)),
                            }}
                            title={`${group.name}\n${shortDate(gStart)} – ${shortDate(gEnd)} · ${group.tasks.length} tarea${group.tasks.length !== 1 ? "s" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Filas de tareas */}
                      {!isCollapsed &&
                        group.tasks.map((task) => {
                          const metrics = barMetrics(task, range);
                          const overdue = isOverdue(task, TODAY);
                          const progress = statusProgressPct(task.status);
                          const assignee = task.assignee_id
                            ? assignees.get(task.assignee_id)
                            : null;
                          const barLeft = pctToPx(metrics.offsetPct);
                          const barW = Math.max(10, pctToPx(metrics.widthPct));
                          const days =
                            toDayNumber(task.due_date) - toDayNumber(task.start_date) + 1;
                          const dateLabel = `${shortDate(task.start_date)} – ${shortDate(task.due_date)} · ${days} d`;
                          // El rótulo va a la derecha de la barra; si no cabe,
                          // se ancla a su izquierda (nunca se corta).
                          const labelFitsRight = barLeft + barW + 140 <= trackWidth;
                          return (
                            <div
                              key={task.id}
                              className="group/row flex items-stretch border-b border-slate-50 last:border-b-0 dark:border-slate-900"
                              style={{ height: ROW_H }}
                            >
                              <div
                                style={{ width: LABEL_W }}
                                className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-white px-3 transition-colors group-hover/row:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:group-hover/row:bg-slate-900"
                              >
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    STATUS_DOT[task.status],
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
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
                              <div className="relative flex-1 transition-colors group-hover/row:bg-slate-50/60 dark:group-hover/row:bg-slate-900/40">
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
                                    "absolute top-1/2 h-[18px] -translate-y-1/2 overflow-hidden rounded-[5px] text-left shadow-sm outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-gold",
                                    STATUS_BAR_SOFT[task.status],
                                    overdue && "ring-1 ring-rose-500",
                                  )}
                                  style={{ left: barLeft, width: barW }}
                                >
                                  <span
                                    className={cn("block h-full", STATUS_BAR_COLOR[task.status])}
                                    style={{ width: `${progress}%` }}
                                  />
                                </button>
                                <span
                                  className={cn(
                                    "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums",
                                    overdue
                                      ? "font-medium text-rose-500"
                                      : "text-slate-400 dark:text-slate-500",
                                  )}
                                  style={
                                    labelFitsRight
                                      ? { left: barLeft + barW + 8 }
                                      : { right: trackWidth - barLeft + 8 }
                                  }
                                >
                                  {dateLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </section>
                  );
                })
              )}
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
