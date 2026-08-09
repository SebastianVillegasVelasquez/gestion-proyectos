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
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  FilterX,
  Spline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkTree } from "../../hooks/use-structure";
import { useProjectTasks, useUpdateTask, useProjectTaskDependencies } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
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
  addDays,
  type TickUnit,
} from "../timeline";
import {
  statusProgressPct,
  isOverdue,
  summarize,
  daysRemaining,
  weightedProgressPct,
} from "../metrics";
import { filterGanttTasks, type GanttFilters } from "../filters";
import { STATUS_BAR_COLOR, STATUS_BAR_SOFT, STATUS_DOT } from "../types";
import { TASK_STATUS_LABELS, USER_POSITION_LABELS } from "../../types/labels";
import type { Project, Task, TaskStatus, UserPosition, WorkItemTree } from "../../types/api.types";
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

// Arrastre de barras: mover la tarea completa o estirar uno de sus extremos.
type DragMode = "move" | "start" | "end";
interface DragInfo {
  taskId: string;
  mode: DragMode;
  startClientX: number;
  origStart: string;
  origDue: string;
}

/** Aplica un desfase en días a una tarea según el modo de arrastre (con guardas
 * para que el inicio nunca supere al fin ni viceversa). Puro y testeable. */
function previewDates(info: DragInfo, deltaDays: number): { start: string; due: string } {
  let start = info.origStart;
  let due = info.origDue;
  if (info.mode === "move") {
    start = addDays(start, deltaDays);
    due = addDays(due, deltaDays);
  } else if (info.mode === "start") {
    start = addDays(start, deltaDays);
    if (start > due) {
      start = due;
    }
  } else {
    due = addDays(due, deltaDays);
    if (due < start) {
      due = start;
    }
  }
  return { start, due };
}

const LEGEND_STATUSES: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

// El cronograma solo ubica tareas con inicio y fin; las tareas sin planificar
// (fechas en null) no tienen barra y se excluyen de la línea de tiempo.
type DatedTask = Task & { start_date: string; due_date: string };

interface NodeGroup {
  id: string;
  name: string;
  order: number;
  tasks: DatedTask[];
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Sintetiza tareas placeholder desde work items con fechas plan, para que el
 * cronograma exista desde que se crea la estructura. Sólo se agregan cuando
 * el work item NO tiene tareas reales asociadas (evita duplicar filas).
 * Estas tareas llevan prefijo `wi-` en el id para distinguirlas y no aparecen
 * en el detalle porque nadie las abre (no llegan del listado real de tareas).
 */
function synthesizeFromStructure(tree: WorkItemTree[], realTasks: Task[]): Task[] {
  const workItemsWithTasks = new Set(realTasks.map((t) => t.work_item_id));
  const acc: Task[] = [];
  const now = new Date().toISOString();
  const visit = (node: WorkItemTree) => {
    if (node.fecha_inicio_plan && node.fecha_fin_plan && !workItemsWithTasks.has(node.id)) {
      acc.push({
        id: `wi-${node.id}`,
        project_id: node.proyecto_id,
        work_item_id: node.id,
        parent_task_id: null,
        title: node.nombre,
        description: null,
        priority: "no_definida",
        assignee_id: null,
        team_id: null,
        start_date: node.fecha_inicio_plan,
        due_date: node.fecha_fin_plan,
        status: "pendiente_por_iniciar",
        completed_at: null,
        created_at: now,
        updated_at: null,
      });
    }
    node.children.forEach(visit);
  };
  tree.forEach(visit);
  return acc;
}

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
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <span className="text-lg font-semibold leading-tight text-foreground">{value}</span>
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
  const teamsQuery = useTeams(project.id);
  const updateTask = useUpdateTask(project.id);
  const dependenciesQuery = useProjectTaskDependencies(project.id);
  const dependencies = useMemo(() => dependenciesQuery.data ?? [], [dependenciesQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data?.items ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  // Estado de filtros, zoom y grupos colapsados.
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [statuses, setStatuses] = useState<Set<TaskStatus>>(() => new Set(LEGEND_STATUSES));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  // Mostrar/ocultar las flechas de dependencia (pueden saturar en proyectos densos).
  const [showDeps, setShowDeps] = useState(true);
  // El colapso/expansión del cronograma se recuerda entre visitas (por proyecto):
  // si dejas todo colapsado, así lo encuentras la próxima vez.
  const collapsedStorageKey = `gantt-collapsed:${project.id}`;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(collapsedStorageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(collapsedStorageKey, JSON.stringify([...collapsedGroups]));
    } catch {
      // Sin persistencia si el almacenamiento no está disponible; no es crítico.
    }
  }, [collapsedGroups, collapsedStorageKey]);

  const realTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  // Cronograma "desde la estructura": si un work item tiene fechas plan y
  // aún no tiene tareas reales, sintetizamos una tarea placeholder para que
  // la línea de tiempo empiece a formarse desde que se crea la estructura.
  // Las tareas reales dictan el tiempo cuando llegan; estas solo son andamiaje.
  const syntheticTasks = useMemo<Task[]>(
    () => synthesizeFromStructure(treeQuery.data ?? [], realTasks),
    [treeQuery.data, realTasks],
  );

  const allTasks = useMemo(() => [...realTasks, ...syntheticTasks], [realTasks, syntheticTasks]);
  // Solo las tareas con inicio y fin son ubicables en el cronograma; las que
  // están sin planificar se dejan fuera de la escala y del agrupado.
  const datedTasks = useMemo(
    () => allTasks.filter((t): t is DatedTask => t.start_date != null && t.due_date != null),
    [allTasks],
  );
  // Deriva del listado en vivo para que el panel refleje adjuntar/quitar de
  // la estructura sin cerrarse y reabrirse.
  const selected = useMemo(
    () => allTasks.find((t) => t.id === selectedId) ?? null,
    [allTasks, selectedId],
  );

  // Mapa user_id → cargo, para poder filtrar por responsabilidad.
  const positionByUser = useMemo(() => {
    const map = new Map<string, UserPosition>();
    (membersQuery.data ?? []).forEach((m) => {
      map.set(m.user_id, m.position as UserPosition);
    });
    return map;
  }, [membersQuery.data]);

  const filters: GanttFilters = useMemo(
    () => ({ statuses, assigneeId, teamId, position, onlyAtRisk }),
    [statuses, assigneeId, teamId, position, onlyAtRisk],
  );
  const tasks = useMemo(
    () => filterGanttTasks(datedTasks, filters, TODAY, positionByUser),
    [datedTasks, filters, positionByUser],
  );

  // El rango se calcula sobre TODAS las tareas (no las filtradas): así el eje
  // de tiempo es estable y filtrar no "salta" la escala. Se le agrega aire en
  // ambos extremos para que ninguna barra toque el borde del área.
  const range = useMemo(() => {
    const raw = computeRange(datedTasks);
    if (!raw) {
      return null;
    }
    const pad = Math.min(14, Math.max(2, Math.ceil(raw.totalDays * 0.04)));
    return padRange(raw, pad, pad + 1);
  }, [datedTasks]);

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
  // Los KPIs miden trabajo REAL: las tareas sintéticas (andamiaje `wi-` desde la
  // estructura) no son tareas todavía, así que no deben inflar los conteos ni
  // arrastrar el % de avance a 0. Siguen dibujándose en la línea de tiempo.
  const realVisibleTasks = useMemo(() => tasks.filter((t) => !t.id.startsWith("wi-")), [tasks]);
  const summary = useMemo(() => summarize(realVisibleTasks, TODAY), [realVisibleTasks]);
  // Avance ponderado por duración (más realista que completadas/total).
  const weightedProgress = useMemo(() => weightedProgressPct(realVisibleTasks), [realVisibleTasks]);
  const remaining = daysRemaining(project.end_date, TODAY);

  const trackWidth = range ? Math.max(MIN_TRACK, range.totalDays * ZOOM_CFG[zoom].px) : MIN_TRACK;
  const pxPerDay = range ? trackWidth / range.totalDays : 0;
  const pctToPx = (pct: number) => (pct / 100) * trackWidth;

  // ── Arrastre de barras (reprogramar sin abrir el panel) ──
  // `drag` guarda el estado inicial del arrastre; `dragDelta` el desfase vivo en
  // días (para el preview). Un ref espeja el delta para leerlo en el `pointerup`
  // sin recrear los listeners en cada movimiento.
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const dragDeltaRef = useRef(0);
  // Distingue un clic (abrir detalle) de un arrastre real (reprogramar).
  const draggedRef = useRef(false);

  const commitDrag = useCallback(
    (info: DragInfo, deltaDays: number) => {
      const { start, due } = previewDates(info, deltaDays);
      if (start === info.origStart && due === info.origDue) {
        return;
      }
      updateTask.mutate({ taskId: info.taskId, payload: { start_date: start, due_date: due } });
    },
    [updateTask],
  );

  const startDrag = (e: React.PointerEvent, task: DatedTask, mode: DragMode) => {
    // Solo tareas reales y planificadas son arrastrables; el clic izquierdo manda.
    if (task.id.startsWith("wi-") || e.button !== 0 || pxPerDay <= 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    draggedRef.current = false;
    dragDeltaRef.current = 0;
    setDragDelta(0);
    setDrag({
      taskId: task.id,
      mode,
      startClientX: e.clientX,
      origStart: task.start_date,
      origDue: task.due_date,
    });
  };

  // Mientras hay arrastre, seguimos el puntero a nivel de ventana (aunque salga
  // de la barra) y confirmamos en `pointerup`.
  useEffect(() => {
    if (!drag || pxPerDay <= 0) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - drag.startClientX) / pxPerDay);
      if (delta !== 0) {
        draggedRef.current = true;
      }
      dragDeltaRef.current = delta;
      setDragDelta(delta);
    };
    const onUp = () => {
      commitDrag(drag, dragDeltaRef.current);
      setDrag(null);
      setDragDelta(0);
      dragDeltaRef.current = 0;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, pxPerDay, commitDrag]);

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
    const byItem = new Map<string, DatedTask[]>();
    // El cronograma agrupa por elemento de la estructura; las tareas sueltas
    // (sin work_item_id todavía) no tienen fila aquí.
    for (const task of tasks) {
      if (!task.work_item_id) {
        continue;
      }
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

  // Geometría de cada fila de tarea visible (no colapsada), en el sistema de
  // coordenadas del cuerpo (y=0 en la primera fila). Sirve para trazar las
  // flechas de dependencia y espeja EXACTAMENTE el orden de render de grupos.
  const layout = useMemo(() => {
    const positions = new Map<string, { yTop: number; left: number; width: number }>();
    if (!range) {
      return { positions, height: 0 };
    }
    let y = 0;
    for (const group of groups) {
      y += ROW_H; // encabezado del grupo
      if (collapsedGroups.has(group.id)) {
        continue; // sus tareas no se renderizan → no ocupan alto
      }
      for (const task of group.tasks) {
        const m = barMetrics(task, range);
        positions.set(task.id, {
          yTop: y,
          left: (m.offsetPct / 100) * trackWidth,
          width: Math.max(10, (m.widthPct / 100) * trackWidth),
        });
        y += ROW_H;
      }
    }
    return { positions, height: y };
  }, [groups, collapsedGroups, range, trackWidth]);

  // Flechas finish-to-start: del extremo derecho de la predecesora al izquierdo
  // de la sucesora. Solo entre tareas visibles (ambas con geometría conocida).
  const arrows = useMemo(() => {
    if (!showDeps) {
      return [];
    }
    const out: { id: string; d: string }[] = [];
    for (const dep of dependencies) {
      const from = layout.positions.get(dep.depends_on_id);
      const to = layout.positions.get(dep.task_id);
      if (!from || !to) {
        continue;
      }
      const x1 = from.left + from.width;
      const y1 = from.yTop + ROW_H / 2;
      const x2 = to.left;
      const y2 = to.yTop + ROW_H / 2;
      const stub = 10;
      // Codo ortogonal: sale a la derecha, baja/sube y entra por la izquierda.
      out.push({
        id: dep.id,
        d: `M ${x1} ${y1} L ${x1 + stub} ${y1} L ${x1 + stub} ${y2} L ${x2 - 2} ${y2}`,
      });
    }
    return out;
  }, [showDeps, dependencies, layout]);

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

  // ¿Hay algún filtro activo? (algún estado apagado o algún selector puesto).
  const hasActiveFilters =
    statuses.size !== LEGEND_STATUSES.length ||
    assigneeId != null ||
    teamId != null ||
    position != null ||
    onlyAtRisk;

  const clearFilters = () => {
    setStatuses(new Set(LEGEND_STATUSES));
    setAssigneeId(null);
    setTeamId(null);
    setPosition(null);
    setOnlyAtRisk(false);
  };

  // Colapsar/expandir todos los grupos visibles de una vez.
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsedGroups.has(g.id));
  const toggleAllGroups = () => {
    setCollapsedGroups(allCollapsed ? new Set() : new Set(groups.map((g) => g.id)));
  };

  const remainingText =
    remaining == null
      ? "—"
      : remaining < 0
        ? `${Math.abs(remaining)} d de retraso`
        : `${remaining} d`;

  const inputCls =
    "rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-full lg:overflow-y-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${project.id}`)}
            className="mb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {project.name}
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      {/* Franja de KPIs (se ajusta a los filtros activos) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={TrendingUp}
          label="Avance ponderado"
          value={`${weightedProgress}%`}
          tone="bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal"
        >
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-gold transition-all"
              style={{ width: `${weightedProgress}%` }}
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
              : "bg-muted text-muted-foreground"
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
                    ? "border-border text-foreground"
                    : "border-transparent text-muted-foreground/50 line-through",
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

          {/* Equipo delegado */}
          {(teamsQuery.data?.items ?? []).length > 0 && (
            <select
              className={inputCls}
              value={teamId ?? ""}
              onChange={(e) => {
                setTeamId(e.target.value || null);
              }}
              aria-label="Filtrar por equipo"
            >
              <option value="">Todos los equipos</option>
              {(teamsQuery.data?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Cargo / responsabilidad */}
          <select
            className={inputCls}
            value={position ?? ""}
            onChange={(e) => {
              setPosition((e.target.value || null) as UserPosition | null);
            }}
            aria-label="Filtrar por responsabilidad"
          >
            <option value="">Todas las responsabilidades</option>
            {Array.from(new Set(Array.from(positionByUser.values()))).map((pos) => (
              <option key={pos} value={pos}>
                {USER_POSITION_LABELS[pos] ?? pos}
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
                : "border-border text-muted-foreground hover:text-foreground",
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
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Centrar el cronograma en la fecha actual"
          >
            <Crosshair className="size-3.5" /> Hoy
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
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
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {ZOOM_CFG[z].label}
              </button>
            ))}
          </div>

          {/* Colapsar / expandir todos los grupos de una vez */}
          <button
            type="button"
            onClick={toggleAllGroups}
            disabled={groups.length === 0}
            title={allCollapsed ? "Expandir todos los grupos" : "Colapsar todos los grupos"}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allCollapsed ? (
              <ChevronsUpDown className="size-3.5" />
            ) : (
              <ChevronsDownUp className="size-3.5" />
            )}
            {allCollapsed ? "Expandir" : "Colapsar"}
          </button>

          {/* Mostrar/ocultar flechas de dependencia */}
          {dependencies.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowDeps((v) => !v);
              }}
              aria-pressed={showDeps}
              title="Mostrar u ocultar las flechas de dependencia"
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                showDeps
                  ? "border-brand-teal/40 bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/10 dark:text-brand-teal"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Spline className="size-3.5" /> Dependencias
            </button>
          )}

          {/* Limpiar filtros: solo aparece si hay alguno activo */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <FilterX className="size-3.5" /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : datedTasks.length === 0 || !range ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
          <GanttChartSquare className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            El cronograma se arma solo cuando los elementos de la estructura tienen fechas plan.
            <br />
            Añade fechas a los elementos o crea tareas para verlas aquí.
          </p>
        </div>
      ) : (
        // Contenedor con scroll en ambos ejes: el eje de tiempo queda fijo
        // arriba y la columna de tareas fija a la izquierda.
        <div
          ref={scrollRef}
          className={cn(
            "scrollbar-none relative max-h-[65vh] overflow-auto overscroll-x-contain rounded-xl border border-border bg-card shadow-sm",
            drag && "select-none",
          )}
        >
          <div className="relative" style={{ width: LABEL_W + trackWidth, minWidth: "100%" }}>
            {/* ── Encabezado sticky: banda de meses + marcas del eje ── */}
            <div className="sticky top-0 z-30 flex border-b border-border bg-card">
              <div
                style={{ width: LABEL_W }}
                className="sticky left-0 z-10 flex shrink-0 items-end border-r border-border bg-card px-3 pb-1.5"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Tareas · {tasks.length}
                </span>
              </div>
              <div className="relative shrink-0" style={{ width: trackWidth }}>
                <div className="relative h-6">
                  {months.map((b) => (
                    <div
                      key={b.key}
                      className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border pl-1.5"
                      style={{ left: pctToPx(b.startPct), width: pctToPx(b.widthPct) }}
                    >
                      {pctToPx(b.widthPct) >= 48 && (
                        <span className="truncate text-[10px] font-semibold text-muted-foreground">
                          {b.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="relative h-5 border-t border-border/70">
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
                          "absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] tabular-nums text-muted-foreground",
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
                    className="absolute inset-y-0 bg-muted/60"
                    style={{ left: pctToPx(b.startPct), width: pctToPx(b.widthPct) }}
                  />
                ))}
                {ticks.map((t) => (
                  <div
                    key={`grid-${t.key}`}
                    className="absolute inset-y-0 w-px bg-border/50"
                    style={{ left: pctToPx(t.offsetPct) }}
                  />
                ))}
                {months.slice(1).map((b) => (
                  <div
                    key={`mline-${b.key}`}
                    className="absolute inset-y-0 w-px bg-border"
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

              {/* Flechas de dependencia (finish-to-start) sobre las barras */}
              {arrows.length > 0 && (
                <svg
                  className="pointer-events-none absolute z-10 text-brand-teal/70"
                  style={{ left: LABEL_W, top: 0, width: trackWidth, height: layout.height }}
                  aria-hidden
                >
                  <defs>
                    <marker
                      id={`gantt-arrow-${project.id}`}
                      markerUnits="userSpaceOnUse"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                    </marker>
                  </defs>
                  {arrows.map((a) => (
                    <path
                      key={a.id}
                      d={a.d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      markerEnd={`url(#gantt-arrow-${project.id})`}
                    />
                  ))}
                </svg>
              )}

              {groups.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="sticky left-0 px-4 text-sm italic text-muted-foreground">
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
                  // Alto exacto del grupo (encabezado + filas si está expandido).
                  // Se lo damos al navegador como tamaño intrínseco para que, con
                  // `content-visibility: auto`, omita el render de los grupos fuera
                  // de pantalla (virtualización nativa) sin saltos de scroll.
                  const sectionHeight = ROW_H * (isCollapsed ? 1 : 1 + group.tasks.length);
                  return (
                    <section
                      key={group.id}
                      style={{
                        contentVisibility: "auto",
                        containIntrinsicSize: `auto ${sectionHeight}px`,
                      }}
                    >
                      {/* Encabezado del grupo: clic = colapsar/expandir */}
                      <div
                        className="flex items-stretch border-b border-border/70"
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
                            "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-l-[3px] border-r border-r-border bg-muted px-2 text-left transition-colors hover:bg-accent",
                            tone.accent,
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform",
                              isCollapsed && "-rotate-90",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                            {group.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-card px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
                            {done}/{group.tasks.length}
                          </span>
                        </button>
                        <div className="relative flex-1 bg-muted/40">
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
                          const draggable = !task.id.startsWith("wi-");
                          // Durante el arrastre, la barra sigue al puntero usando
                          // las fechas de preview; al soltar se persiste.
                          const isDragging = drag?.taskId === task.id;
                          const view = isDragging
                            ? previewDates(drag, dragDelta)
                            : { start: task.start_date, due: task.due_date };
                          const metrics = barMetrics(
                            { start_date: view.start, due_date: view.due },
                            range,
                          );
                          const overdue = isOverdue(task, TODAY);
                          const progress = statusProgressPct(task.status);
                          const assignee = task.assignee_id
                            ? assignees.get(task.assignee_id)
                            : null;
                          const teamLabel = task.team_id ? teamNameById.get(task.team_id) : null;
                          const barLeft = pctToPx(metrics.offsetPct);
                          const barW = Math.max(10, pctToPx(metrics.widthPct));
                          const days = toDayNumber(view.due) - toDayNumber(view.start) + 1;
                          const dateLabel = `${shortDate(view.start)} – ${shortDate(view.due)} · ${days} d`;
                          // El rótulo va a la derecha de la barra; si no cabe,
                          // se ancla a su izquierda (nunca se corta).
                          const labelFitsRight = barLeft + barW + 140 <= trackWidth;
                          return (
                            <div
                              key={task.id}
                              className="group/row flex items-stretch border-b border-border/50 last:border-b-0"
                              style={{ height: ROW_H }}
                            >
                              <button
                                type="button"
                                disabled={task.id.startsWith("wi-")}
                                onClick={() => {
                                  // Las sintéticas (id `wi-…`) vienen de la estructura,
                                  // no del listado real: no abren el panel de detalle.
                                  if (task.id.startsWith("wi-")) {
                                    return;
                                  }
                                  setSelectedId(task.id);
                                }}
                                title={
                                  task.id.startsWith("wi-") ? undefined : "Ver y editar la tarea"
                                }
                                style={{ width: LABEL_W }}
                                className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border bg-card px-3 text-left transition-colors group-hover/row:bg-muted enabled:cursor-pointer enabled:hover:bg-muted"
                              >
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    STATUS_DOT[task.status],
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs text-foreground">{task.title}</p>
                                  {teamLabel && (
                                    <p className="truncate text-[9px] font-medium text-violet-500 dark:text-violet-400">
                                      {teamLabel}
                                    </p>
                                  )}
                                </div>
                                <span
                                  title={assignee?.name ?? "Sin responsable"}
                                  className={cn(
                                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                                    assignee
                                      ? "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {assignee?.initials ?? "—"}
                                </span>
                              </button>
                              <div className="relative flex-1 transition-colors group-hover/row:bg-muted/40">
                                <button
                                  type="button"
                                  onPointerDown={(e) => {
                                    if (draggable) {
                                      startDrag(e, task, "move");
                                    }
                                  }}
                                  onClick={() => {
                                    // Tras un arrastre real no abrimos el detalle
                                    // (fue una reprogramación, no un clic).
                                    if (draggedRef.current) {
                                      draggedRef.current = false;
                                      return;
                                    }
                                    // Las sintéticas (id `wi-…`) no abren detalle.
                                    if (!draggable) {
                                      return;
                                    }
                                    setSelectedId(task.id);
                                  }}
                                  title={[
                                    task.title,
                                    teamLabel ? `Equipo: ${teamLabel}` : null,
                                    assignee?.name ?? "Sin responsable",
                                    `${view.start} → ${view.due}`,
                                    `${TASK_STATUS_LABELS[task.status]} · ${progress}%`,
                                    draggable ? "Arrastra para reprogramar" : null,
                                  ]
                                    .filter(Boolean)
                                    .join("\n")}
                                  className={cn(
                                    "absolute top-1/2 h-[18px] -translate-y-1/2 overflow-hidden rounded-[5px] text-left shadow-sm outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-gold",
                                    STATUS_BAR_SOFT[task.status],
                                    overdue && "ring-1 ring-rose-500",
                                    draggable && "cursor-grab touch-none",
                                    isDragging && "z-30 cursor-grabbing ring-2 ring-brand-gold",
                                  )}
                                  style={{ left: barLeft, width: barW }}
                                >
                                  <span
                                    className={cn("block h-full", STATUS_BAR_COLOR[task.status])}
                                    style={{ width: `${progress}%` }}
                                  />
                                </button>

                                {/* Manijas de redimensionado (estirar inicio/fin) */}
                                {draggable && (
                                  <>
                                    <div
                                      role="slider"
                                      aria-label="Ajustar inicio"
                                      aria-valuetext={view.start}
                                      tabIndex={-1}
                                      onPointerDown={(e) => {
                                        startDrag(e, task, "start");
                                      }}
                                      className={cn(
                                        "absolute top-1/2 z-30 h-[18px] w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-l-[5px] bg-brand-gold/70 opacity-0 transition-opacity group-hover/row:opacity-100",
                                        isDragging && "opacity-100",
                                      )}
                                      style={{ left: barLeft }}
                                    />
                                    <div
                                      role="slider"
                                      aria-label="Ajustar fin"
                                      aria-valuetext={view.due}
                                      tabIndex={-1}
                                      onPointerDown={(e) => {
                                        startDrag(e, task, "end");
                                      }}
                                      className={cn(
                                        "absolute top-1/2 z-30 h-[18px] w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-r-[5px] bg-brand-gold/70 opacity-0 transition-opacity group-hover/row:opacity-100",
                                        isDragging && "opacity-100",
                                      )}
                                      style={{ left: barLeft + barW - 8 }}
                                    />
                                  </>
                                )}

                                <span
                                  className={cn(
                                    "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums",
                                    isDragging
                                      ? "font-semibold text-brand-gold-dark dark:text-brand-gold"
                                      : overdue
                                        ? "font-medium text-rose-500"
                                        : "text-muted-foreground",
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
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
