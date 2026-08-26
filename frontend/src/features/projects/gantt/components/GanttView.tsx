import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Moon,
  Sun,
  FolderTree,
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
  Tag,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkTree, useNodeTypes, useMoveWorkItem } from "../../hooks/use-structure";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  dropPosFromEvent,
  findNode,
  subtreeIds,
  resolveDrop,
  type DropPos,
} from "../../utils/work-tree-dnd";
import { useDragAutoScroll } from "../../utils/use-drag-auto-scroll";
import { useProjectTasks, useUpdateTask, useProjectTaskDependencies } from "../../hooks/use-tasks";
import { useProjectMembers } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
import { tipoStyle } from "../../utils/tipo-style";
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
  type TimelineRange,
} from "../timeline";
import {
  statusProgressPct,
  isOverdue,
  summarize,
  daysRemaining,
  weightedProgressPct,
} from "../metrics";
import { useShiftWorkItem } from "../../hooks/use-structure";
import { filterGanttTasks, type GanttFilters } from "../filters";
import { buildGanttRows, collectPlanSpans, type GanttNodeRow } from "../tree";
import type { DatedTask } from "../task";
import { STATUS_BAR_COLOR, STATUS_BAR_SOFT, STATUS_DOT } from "../types";
import { TASK_STATUS_LABELS, USER_POSITION_LABELS } from "../../types/labels";
import type { Project, TaskStatus, UserPosition } from "../../types/api.types";
import { DateConflictModal } from "../../components/detail/DateConflictModal";
import { TaskDetailPanel } from "./TaskDetailPanel";

// Ancho por defecto de la columna de etiquetas (el usuario puede redimensionarla).
const LABEL_W_DEFAULT = 240;
const LABEL_W_MIN = 168;
const LABEL_W_MAX = 560;
// Ancho mínimo del área de tiempo, para que proyectos cortos no se aplasten.
const MIN_TRACK = 480;
// Alto de cada fila (nodo o tarea).
const ROW_H = 36;
// Sangría por nivel de profundidad en la columna de etiquetas.
const INDENT = 14;

// Configuración por nivel de zoom: px por día y unidad natural de las marcas.
const ZOOM_CFG: Record<"mes" | "semana" | "dia", { px: number; unit: TickUnit; label: string }> = {
  mes: { px: 6, unit: "month", label: "Mes" },
  semana: { px: 16, unit: "week", label: "Semana" },
  dia: { px: 36, unit: "day", label: "Día" },
};
type Zoom = keyof typeof ZOOM_CFG;

// Arrastre de barras: mover la tarea/nodo completo o estirar un extremo (tareas).
type DragMode = "move" | "start" | "end";
type DragKind = "task" | "node";
interface DragInfo {
  kind: DragKind;
  id: string;
  mode: DragMode;
  startClientX: number;
  origStart: string;
  origDue: string;
}
/** Descriptor de lo que se arrastra: una tarea (reprograma) o un nodo (desplaza
 * todo su subárbol). El tipo determina qué mutación se dispara al soltar. */
interface DragTarget {
  kind: DragKind;
  id: string;
  start: string;
  due: string;
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
  const typesQuery = useNodeTypes(project.id);
  const tasksQuery = useProjectTasks(project.id);
  const membersQuery = useProjectMembers(project.id);
  const teamsQuery = useTeams(project.id);
  const updateTask = useUpdateTask(project.id);
  const shiftWorkItem = useShiftWorkItem(project.id);
  const dependenciesQuery = useProjectTaskDependencies(project.id);
  const dependencies = useMemo(() => dependenciesQuery.data ?? [], [dependenciesQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    types.forEach((t) => map.set(t.id, t.nombre));
    return map;
  }, [types]);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data?.items ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  // Estado de filtros, zoom, tipos y nodos colapsados.
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [statuses, setStatuses] = useState<Set<TaskStatus>>(() => new Set(LEGEND_STATUSES));
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  // Filtro por tipo de elemento (Curso, Módulo…); vacío = todos.
  const [activeTypeIds, setActiveTypeIds] = useState<Set<string>>(() => new Set());
  // Mostrar/ocultar las tareas como filas hijas bajo cada elemento.
  const [showTasks, setShowTasks] = useState(true);
  // Mostrar/ocultar las flechas de dependencia (pueden saturar en proyectos densos).
  const [showDeps, setShowDeps] = useState(true);

  // El colapso/expansión del cronograma se recuerda entre visitas (por proyecto):
  // si dejas todo colapsado, así lo encuentras la próxima vez.
  const collapsedStorageKey = `gantt-collapsed:${project.id}`;
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(collapsedStorageKey);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(collapsedStorageKey, JSON.stringify([...collapsedNodes]));
    } catch {
      // Sin persistencia si el almacenamiento no está disponible; no es crítico.
    }
  }, [collapsedNodes, collapsedStorageKey]);

  // Ancho de la columna de etiquetas, redimensionable y persistido por proyecto.
  const labelStorageKey = `gantt-labelw:${project.id}`;
  const [labelW, setLabelW] = useState<number>(() => {
    const raw = Number(localStorage.getItem(labelStorageKey));
    return Number.isFinite(raw) && raw >= LABEL_W_MIN
      ? Math.min(LABEL_W_MAX, raw)
      : LABEL_W_DEFAULT;
  });
  useEffect(() => {
    try {
      localStorage.setItem(labelStorageKey, String(labelW));
    } catch {
      // no crítico
    }
  }, [labelW, labelStorageKey]);

  const realTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  // Solo las tareas con inicio y fin son ubicables en el cronograma.
  const datedTasks = useMemo(
    () => realTasks.filter((t): t is DatedTask => t.start_date != null && t.due_date != null),
    [realTasks],
  );
  const selected = useMemo(
    () => realTasks.find((t) => t.id === selectedId) ?? null,
    [realTasks, selectedId],
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

  // Tareas filtradas agrupadas por elemento, para colgarlas del árbol.
  const tasksByItem = useMemo(() => {
    const map = new Map<string, DatedTask[]>();
    for (const task of tasks) {
      if (!task.work_item_id) {
        continue;
      }
      const arr = map.get(task.work_item_id) ?? [];
      arr.push(task);
      map.set(task.work_item_id, arr);
    }
    return map;
  }, [tasks]);

  // Filas del cronograma: la estructura del proyecto aplanada en orden DFS, con
  // las tareas colgando de su elemento. Una sola fuente de verdad para render,
  // geometría de barras y flechas de dependencia.
  const rows = useMemo(
    () =>
      buildGanttRows({
        tree,
        tasksByItem,
        isCollapsed: (id) => collapsedNodes.has(id),
        showTasks,
        activeTypeIds,
      }),
    [tree, tasksByItem, collapsedNodes, showTasks, activeTypeIds],
  );

  const nodeCount = useMemo(() => rows.filter((r) => r.kind === "node").length, [rows]);
  const taskRowCount = rows.length - nodeCount;

  // El rango cubre tareas + fechas plan de la estructura, para que el eje exista
  // desde que hay estructura (aunque aún no haya tareas). Se calcula sobre TODO
  // (no lo filtrado) para que el eje sea estable y filtrar no "salte" la escala.
  const range = useMemo(() => {
    const raw = computeRange([...datedTasks, ...collectPlanSpans(tree)]);
    if (!raw) {
      return null;
    }
    const pad = Math.min(14, Math.max(2, Math.ceil(raw.totalDays * 0.04)));
    return padRange(raw, pad, pad + 1);
  }, [datedTasks, tree]);

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
  const weightedProgress = useMemo(() => weightedProgressPct(tasks), [tasks]);
  const remaining = daysRemaining(project.end_date, TODAY);

  const trackWidth = range ? Math.max(MIN_TRACK, range.totalDays * ZOOM_CFG[zoom].px) : MIN_TRACK;
  const pxPerDay = range ? trackWidth / range.totalDays : 0;
  const pctToPx = (pct: number) => (pct / 100) * trackWidth;

  // ── Arrastre de barras (reprogramar sin abrir el panel) ──
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
      if (info.kind === "node") {
        // Arrastrar un nodo desplaza TODO su subárbol (estructura + tareas).
        shiftWorkItem.mutate({ itemId: info.id, payload: { offset_days: deltaDays } });
      } else {
        updateTask.mutate({ taskId: info.id, payload: { start_date: start, due_date: due } });
      }
    },
    [updateTask, shiftWorkItem],
  );

  const startDrag = (e: React.PointerEvent, target: DragTarget, mode: DragMode) => {
    if (e.button !== 0 || pxPerDay <= 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    draggedRef.current = false;
    dragDeltaRef.current = 0;
    setDragDelta(0);
    setDrag({
      kind: target.kind,
      id: target.id,
      mode,
      startClientX: e.clientX,
      origStart: target.start,
      origDue: target.due,
    });
  };

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

  // ── Redimensionado de la columna de etiquetas ──
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startW: labelW };
    setResizing(true);
  };
  useEffect(() => {
    if (!resizing) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) {
        return;
      }
      const next = r.startW + (e.clientX - r.startX);
      setLabelW(Math.min(LABEL_W_MAX, Math.max(LABEL_W_MIN, next)));
    };
    const onUp = () => {
      setResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing]);

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
      el.scrollTo({ left: contentX - (el.clientWidth - labelW) / 2, behavior });
    },
    [todayPct, trackWidth, labelW],
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

  // Geometría de cada fila de tarea visible, en el sistema de coordenadas del
  // cuerpo (y=0 en la primera fila). Espeja EXACTAMENTE el orden de `rows` y
  // sirve para trazar las flechas de dependencia.
  const layout = useMemo(() => {
    const positions = new Map<string, { yTop: number; left: number; width: number }>();
    if (!range) {
      return { positions, height: 0 };
    }
    let y = 0;
    for (const row of rows) {
      if (row.kind === "task") {
        const m = barMetrics(row.task, range);
        positions.set(row.task.id, {
          yTop: y,
          left: (m.offsetPct / 100) * trackWidth,
          width: Math.max(10, (m.widthPct / 100) * trackWidth),
        });
      }
      y += ROW_H;
    }
    return { positions, height: y };
  }, [rows, range, trackWidth]);

  // Flechas finish-to-start entre tareas visibles (ambas con geometría conocida).
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

  const toggleNode = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Drag & drop del panel izquierdo: recoloca nodos igual que el árbol de
  // Estructura (misma lógica, mismo query key → ambos paneles quedan en sync). ──
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  // Escrito de forma síncrona al empezar el arrastre: el estado de React puede
  // llegar tarde al primer `dragover` y, sin `preventDefault()`, el navegador
  // marca esa fila como destino inválido (ver StructurePanel).
  const draggingNodeIdRef = useRef<string | null>(null);
  const [nodeDropTarget, setNodeDropTarget] = useState<{ id: string; pos: DropPos } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  // Elemento cuyo desajuste de fechas se está resolviendo. Guardamos el id (no
  // el nodo) para que el modal lea siempre el árbol recién cargado.
  const [conflictItemId, setConflictItemId] = useState<string | null>(null);
  const moveWorkItem = useMoveWorkItem(project.id);

  const invalidNodeDropIds = useMemo(() => {
    if (!draggingNodeId) {
      return new Set<string>();
    }
    const dragged = findNode(tree, draggingNodeId);
    return dragged ? subtreeIds(dragged) : new Set<string>();
  }, [draggingNodeId, tree]);

  // El cronograma también se auto-desplaza al arrastrar cerca de sus bordes: sin
  // esto no se puede alcanzar una fila que quedó fuera de la parte visible.
  useDragAutoScroll(scrollRef, draggingNodeId != null);

  // Apertura automática de una rama plegada al posarse sobre ella (igual que en
  // el panel de Estructura), para poder soltar dentro sin abrirla antes.
  const nodeSpringRef = useRef<{ id: string; timer: number } | null>(null);

  function cancelNodeSpringOpen() {
    if (nodeSpringRef.current) {
      clearTimeout(nodeSpringRef.current.timer);
      nodeSpringRef.current = null;
    }
  }

  function scheduleNodeSpringOpen(id: string, pos: DropPos) {
    if (nodeSpringRef.current?.id === id) {
      return;
    }
    cancelNodeSpringOpen();
    if (pos !== "inside" || !collapsedNodes.has(id)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      nodeSpringRef.current = null;
    }, 600);
    nodeSpringRef.current = { id, timer };
  }

  function startNodeDrag(id: string) {
    draggingNodeIdRef.current = id;
    setDraggingNodeId(id);
  }

  function resetNodeDrag() {
    cancelNodeSpringOpen();
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    setNodeDropTarget(null);
  }

  function handleNodeDropOn(targetId: string, pos: DropPos) {
    const itemId = draggingNodeId;
    resetNodeDrag();
    if (!itemId) {
      return;
    }
    // Las reglas viven en `resolveDrop`, compartidas con el panel de Estructura:
    // ambas vistas muestran el mismo árbol y deben aceptar lo mismo.
    const decision = resolveDrop(tree, itemId, targetId, pos);
    if (!decision) {
      return;
    }
    if (!decision.ok) {
      setMoveError(decision.reason);
      return;
    }
    setMoveError(null);
    moveWorkItem.mutate(
      { itemId, payload: decision.payload },
      {
        onError: (err) => {
          setMoveError(getErrorMessage(err, "No se pudo mover el elemento"));
        },
      },
    );
  }

  const toggleType = (id: string) => {
    setActiveTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Todos los ids de nodo con hijos (para "colapsar / expandir todo"), tomados
  // del árbol completo (no solo lo visible) para poder re-expandir desde cero.
  const collapsibleIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          ids.push(n.id);
          walk(n.children);
        }
      }
    };
    walk(tree);
    return ids;
  }, [tree]);
  const allCollapsed =
    collapsibleIds.length > 0 && collapsibleIds.every((id) => collapsedNodes.has(id));
  const toggleAllNodes = () => {
    setCollapsedNodes(allCollapsed ? new Set() : new Set(collapsibleIds));
  };

  const hasActiveFilters =
    statuses.size !== LEGEND_STATUSES.length ||
    assigneeId != null ||
    teamId != null ||
    position != null ||
    onlyAtRisk ||
    activeTypeIds.size > 0;

  const clearFilters = () => {
    setStatuses(new Set(LEGEND_STATUSES));
    setAssigneeId(null);
    setTeamId(null);
    setPosition(null);
    setOnlyAtRisk(false);
    setActiveTypeIds(new Set());
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
          {/* Atajo a la Estructura: es el viaje de ida y vuelta natural
              (allí ya existe el botón "Cronograma"), y las fechas se editan
              desde ese lado. */}
          <button
            type="button"
            onClick={() => void navigate(`/projects/${project.id}/estructura`)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <FolderTree className="size-4 text-brand-teal" /> Estructura
          </button>
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

      {moveError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          <span>{moveError}</span>
          <button
            type="button"
            onClick={() => {
              setMoveError(null);
            }}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Cerrar
          </button>
        </div>
      )}

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

      {/* Filtro por tipo de elemento (Curso, Módulo…), espejo de la estructura */}
      {types.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Tag className="size-3" /> Tipos
          </span>
          {types.map((t) => {
            const style = tipoStyle(t.id);
            const active = activeTypeIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  toggleType(t.id);
                }}
                aria-pressed={active}
                title="Filtrar por este tipo de elemento"
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                  style.chip,
                  active ? "border-current" : "border-transparent",
                  activeTypeIds.size > 0 && !active && "opacity-40",
                )}
              >
                <span className={cn("size-1.5 rounded-full", style.dot)} />
                {t.nombre}
              </button>
            );
          })}
        </div>
      )}

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

          {/* Mostrar / ocultar tareas bajo cada elemento */}
          <button
            type="button"
            onClick={() => {
              setShowTasks((v) => !v);
            }}
            aria-pressed={showTasks}
            title="Mostrar u ocultar las tareas bajo cada elemento"
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
              showTasks
                ? "border-brand-teal/40 bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/10 dark:text-brand-teal"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <ListChecks className="size-3.5" /> Tareas
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

          {/* Colapsar / expandir toda la estructura de una vez */}
          <button
            type="button"
            onClick={toggleAllNodes}
            disabled={collapsibleIds.length === 0}
            title={allCollapsed ? "Expandir toda la estructura" : "Colapsar toda la estructura"}
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

      {tasksQuery.isLoading || treeQuery.isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : !range ? (
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
        // arriba y la columna de etiquetas fija a la izquierda.
        <div
          ref={scrollRef}
          className={cn(
            "scrollbar-none relative max-h-[65vh] overflow-auto overscroll-x-contain rounded-xl border border-border bg-card shadow-sm",
            (drag != null || resizing) && "select-none",
          )}
        >
          <div className="relative" style={{ width: labelW + trackWidth, minWidth: "100%" }}>
            {/* ── Encabezado sticky: banda de meses + marcas del eje ── */}
            <div className="sticky top-0 z-30 flex border-b border-border bg-card">
              <div
                style={{ width: labelW }}
                className="sticky left-0 z-10 flex shrink-0 items-end border-r border-border bg-card px-3 pb-1.5"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Estructura · {nodeCount} · {taskRowCount} tareas
                </span>
                {/* Manija para redimensionar la columna de etiquetas */}
                <div
                  onPointerDown={startResize}
                  role="separator"
                  aria-label="Redimensionar la columna de nombres"
                  aria-orientation="vertical"
                  title="Arrastra para ampliar la columna de nombres"
                  className={cn(
                    "absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none transition-colors hover:bg-brand-gold/50",
                    resizing && "bg-brand-gold/60",
                  )}
                />
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
                      return null;
                    }
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
                style={{ left: labelW, width: trackWidth }}
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
                  style={{ left: labelW + pctToPx(todayPct) }}
                />
              )}

              {/* Flechas de dependencia (finish-to-start) sobre las barras */}
              {arrows.length > 0 && (
                <svg
                  className="pointer-events-none absolute z-10 text-brand-teal/70"
                  style={{ left: labelW, top: 0, width: trackWidth, height: layout.height }}
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

              {rows.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="sticky left-0 px-4 text-sm italic text-muted-foreground">
                    No hay elementos que coincidan con los filtros.
                  </p>
                </div>
              ) : (
                rows.map((row) =>
                  row.kind === "node" ? (
                    <NodeRow
                      key={row.id}
                      row={row}
                      range={range}
                      labelW={labelW}
                      pctToPx={pctToPx}
                      typeName={typeNameById.get(row.tipoId) ?? "elemento"}
                      collapsed={collapsedNodes.has(row.id)}
                      drag={drag}
                      dragDelta={dragDelta}
                      startDrag={startDrag}
                      draggedRef={draggedRef}
                      onToggle={() => {
                        if (row.hasChildren) {
                          toggleNode(row.id);
                        }
                      }}
                      isDraggingNode={draggingNodeId === row.id}
                      nodeDropPos={
                        nodeDropTarget?.id === row.id &&
                        draggingNodeId != null &&
                        !invalidNodeDropIds.has(row.id)
                          ? nodeDropTarget.pos
                          : null
                      }
                      onDragStartNode={() => {
                        startNodeDrag(row.id);
                      }}
                      onDragEndNode={resetNodeDrag}
                      isInvalidNodeDrop={draggingNodeId != null && invalidNodeDropIds.has(row.id)}
                      onDragOverNode={(pos) => {
                        if (draggingNodeIdRef.current == null || invalidNodeDropIds.has(row.id)) {
                          return;
                        }
                        setNodeDropTarget({ id: row.id, pos });
                        scheduleNodeSpringOpen(row.id, pos);
                      }}
                      onDropNode={(pos) => {
                        handleNodeDropOn(row.id, pos);
                      }}
                      onResolveConflict={() => {
                        setConflictItemId(row.id);
                      }}
                    />
                  ) : (
                    <TaskRow
                      key={row.id}
                      task={row.task}
                      depth={row.depth}
                      range={range}
                      labelW={labelW}
                      trackWidth={trackWidth}
                      pctToPx={pctToPx}
                      assignee={row.task.assignee_id ? assignees.get(row.task.assignee_id) : null}
                      teamLabel={row.task.team_id ? teamNameById.get(row.task.team_id) : null}
                      drag={drag}
                      dragDelta={dragDelta}
                      startDrag={startDrag}
                      draggedRef={draggedRef}
                      onOpen={() => {
                        setSelectedId(row.task.id);
                      }}
                    />
                  ),
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ajuste de fechas: el mismo modal que en la Estructura, para que el
          aviso haga lo mismo se mire desde donde se mire. */}
      {(() => {
        const item = conflictItemId ? findNode(tree, conflictItemId) : null;
        const container = item?.parent_id ? findNode(tree, item.parent_id) : null;
        if (!item || !container) {
          return null;
        }
        return (
          <DateConflictModal
            projectId={project.id}
            item={item}
            container={container}
            onClose={() => {
              setConflictItemId(null);
            }}
          />
        );
      })()}

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

// ── Fila de nodo (elemento de la estructura) ─────────────────────────────────

function NodeRow({
  row,
  range,
  labelW,
  pctToPx,
  typeName,
  collapsed,
  drag,
  dragDelta,
  startDrag,
  draggedRef,
  onToggle,
  isDraggingNode,
  nodeDropPos,
  isInvalidNodeDrop,
  onDragStartNode,
  onDragEndNode,
  onDragOverNode,
  onDropNode,
  onResolveConflict,
}: {
  row: GanttNodeRow;
  range: TimelineRange;
  labelW: number;
  pctToPx: (pct: number) => number;
  typeName: string;
  collapsed: boolean;
  drag: DragInfo | null;
  dragDelta: number;
  startDrag: (e: React.PointerEvent, target: DragTarget, mode: DragMode) => void;
  draggedRef: React.RefObject<boolean>;
  onToggle: () => void;
  // ── Drag & drop de reordenamiento del árbol (distinto del drag de la barra) ──
  isDraggingNode: boolean;
  nodeDropPos: DropPos | null;
  isInvalidNodeDrop: boolean;
  onDragStartNode: () => void;
  onDragEndNode: () => void;
  onDragOverNode: (pos: DropPos) => void;
  onDropNode: (pos: DropPos) => void;
  onResolveConflict: () => void;
}) {
  const style = tipoStyle(row.tipoId);
  const isDragging = drag?.id === row.id;
  // Al arrastrar, la barra resumen sigue al puntero con las fechas de preview.
  const view = isDragging ? previewDates(drag, dragDelta) : { start: row.start, due: row.due };
  const gm = barMetrics({ start_date: view.start, due_date: view.due }, range);
  const pct = row.taskCount > 0 ? Math.round((row.doneCount / row.taskCount) * 100) : 0;
  const target: DragTarget = { kind: "node", id: row.id, start: row.start, due: row.due };
  return (
    <div className="flex items-stretch border-b border-border/70" style={{ height: ROW_H }}>
      <div className="sticky left-0 z-20 shrink-0 relative" style={{ width: labelW }}>
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", row.id);
            onDragStartNode();
          }}
          onDragEnd={onDragEndNode}
          onDragOver={(e) => {
            // Sin preventDefault el navegador marca la fila como destino no
            // válido: así el cursor "no-drop" aparece justo sobre el propio
            // subárbol, en vez de aceptar la suelta y rechazarla después.
            if (isInvalidNodeDrop) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            onDragOverNode(dropPosFromEvent(e));
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDropNode(dropPosFromEvent(e));
          }}
          onClick={onToggle}
          aria-expanded={!collapsed}
          style={{ width: labelW, paddingLeft: 8 + row.depth * INDENT, height: ROW_H }}
          className={cn(
            "relative flex shrink-0 items-center gap-1.5 border-r border-r-border bg-muted pr-2 text-left transition-colors",
            row.hasChildren ? "hover:bg-accent" : "cursor-default",
            isDraggingNode && "opacity-40",
            isInvalidNodeDrop && !isDraggingNode && "opacity-50",
            nodeDropPos === "inside" && "ring-2 ring-inset ring-brand-teal bg-brand-teal/5",
          )}
        >
          {nodeDropPos === "before" && (
            <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-brand-teal" aria-hidden />
          )}
          {nodeDropPos === "after" && (
            <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-brand-teal" aria-hidden />
          )}
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
              !row.hasChildren && "invisible",
            )}
          />
          <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
              style.chip,
            )}
          >
            {typeName}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {row.name}
          </span>
          {/* Hueco para el aviso de fechas, que va fuera de este botón (no se
              pueden anidar botones): así el texto no queda debajo del icono. */}
          {row.conflictoFechas && <span className="w-5 shrink-0" aria-hidden />}
          {row.taskCount > 0 && (
            <span className="shrink-0 rounded-full bg-card px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
              {row.doneCount}/{row.taskCount}
            </span>
          )}
        </button>
        {/* Mismo aviso que en la Estructura y con el mismo comportamiento: abre
            el ajuste de fechas. Va como hermano del botón de la fila —y no
            dentro— porque un botón no puede contener otro botón. */}
        {row.conflictoFechas && (
          <button
            type="button"
            onClick={onResolveConflict}
            title={`${row.name} termina más tarde que lo que lo contiene. Click para ajustar las fechas.`}
            aria-label={`Ajustar fechas de ${row.name}`}
            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <CalendarClock className="size-3.5" />
          </button>
        )}
      </div>
      <div className="relative flex-1 bg-muted/40">
        {/* Barra resumen del nodo: arrastrar desplaza TODO el subárbol. */}
        <button
          type="button"
          onPointerDown={(e) => {
            startDrag(e, target, "move");
          }}
          onClick={(e) => {
            // Tras un arrastre real, no dispares el toggle (fue reprogramación).
            if (draggedRef.current) {
              draggedRef.current = false;
              e.stopPropagation();
            }
          }}
          title={`${row.name}\n${shortDate(view.start)} – ${shortDate(view.due)} · ${row.taskCount} tarea${row.taskCount !== 1 ? "s" : ""}\nArrastra para reprogramar el bloque`}
          className={cn(
            "absolute top-1/2 h-2.5 -translate-y-1/2 cursor-grab touch-none overflow-hidden rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-brand-gold",
            isDragging && "z-30 cursor-grabbing h-3 ring-2 ring-brand-gold",
          )}
          style={{ left: pctToPx(gm.offsetPct), width: Math.max(8, pctToPx(gm.widthPct)) }}
        >
          <div className={cn("h-full opacity-30", style.bar)} />
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", style.bar)}
            style={{ width: `${pct}%` }}
          />
        </button>
      </div>
    </div>
  );
}

// ── Fila de tarea ────────────────────────────────────────────────────────────

function TaskRow({
  task,
  depth,
  range,
  labelW,
  trackWidth,
  pctToPx,
  assignee,
  teamLabel,
  drag,
  dragDelta,
  startDrag,
  draggedRef,
  onOpen,
}: {
  task: DatedTask;
  depth: number;
  range: TimelineRange;
  labelW: number;
  trackWidth: number;
  pctToPx: (pct: number) => number;
  assignee: { initials: string; name: string } | null | undefined;
  teamLabel: string | null | undefined;
  drag: DragInfo | null;
  dragDelta: number;
  startDrag: (e: React.PointerEvent, target: DragTarget, mode: DragMode) => void;
  draggedRef: React.RefObject<boolean>;
  onOpen: () => void;
}) {
  const target: DragTarget = {
    kind: "task",
    id: task.id,
    start: task.start_date,
    due: task.due_date,
  };
  const isDragging = drag?.id === task.id;
  const view = isDragging
    ? previewDates(drag, dragDelta)
    : { start: task.start_date, due: task.due_date };
  const metrics = barMetrics({ start_date: view.start, due_date: view.due }, range);
  const overdue = isOverdue(task, TODAY);
  const progress = statusProgressPct(task.status);
  const barLeft = pctToPx(metrics.offsetPct);
  const barW = Math.max(10, pctToPx(metrics.widthPct));
  const days = toDayNumber(view.due) - toDayNumber(view.start) + 1;
  const dateLabel = `${shortDate(view.start)} – ${shortDate(view.due)} · ${days} d`;
  const labelFitsRight = barLeft + barW + 140 <= trackWidth;

  return (
    <div
      className="group/row flex items-stretch border-b border-border/50 last:border-b-0"
      style={{ height: ROW_H, contentVisibility: "auto", containIntrinsicSize: `auto ${ROW_H}px` }}
    >
      <button
        type="button"
        onClick={onOpen}
        title="Ver y editar la tarea"
        style={{ width: labelW, paddingLeft: 8 + depth * INDENT }}
        className="sticky left-0 z-20 flex shrink-0 cursor-pointer items-center gap-2 border-r border-border bg-card pr-3 text-left transition-colors group-hover/row:bg-muted hover:bg-muted"
      >
        <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[task.status])} />
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
            startDrag(e, target, "move");
          }}
          onClick={() => {
            // Tras un arrastre real no abrimos el detalle (fue reprogramación).
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            onOpen();
          }}
          title={[
            task.title,
            teamLabel ? `Equipo: ${teamLabel}` : null,
            assignee?.name ?? "Sin responsable",
            `${view.start} → ${view.due}`,
            `${TASK_STATUS_LABELS[task.status]} · ${progress}%`,
            "Arrastra para reprogramar",
          ]
            .filter(Boolean)
            .join("\n")}
          className={cn(
            "absolute top-1/2 h-[18px] -translate-y-1/2 cursor-grab touch-none overflow-hidden rounded-[5px] text-left shadow-sm outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-brand-gold",
            STATUS_BAR_SOFT[task.status],
            overdue && "ring-1 ring-rose-500",
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
        <div
          role="slider"
          aria-label="Ajustar inicio"
          aria-valuetext={view.start}
          tabIndex={-1}
          onPointerDown={(e) => {
            startDrag(e, target, "start");
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
            startDrag(e, target, "end");
          }}
          className={cn(
            "absolute top-1/2 z-30 h-[18px] w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-r-[5px] bg-brand-gold/70 opacity-0 transition-opacity group-hover/row:opacity-100",
            isDragging && "opacity-100",
          )}
          style={{ left: barLeft + barW - 8 }}
        />

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
            labelFitsRight ? { left: barLeft + barW + 8 } : { right: trackWidth - barLeft + 8 }
          }
        >
          {dateLabel}
        </span>
      </div>
    </div>
  );
}
