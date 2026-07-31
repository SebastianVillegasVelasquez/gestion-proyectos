import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Crosshair, GanttChartSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
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
} from "@/features/projects/gantt/timeline";
import { isOverdue } from "@/features/projects/gantt/metrics";
import {
  STATUS_BAR_COLOR,
  STATUS_BAR_SOFT,
  STATUS_DOT,
  TASK_STATUS_LABELS,
} from "@/features/projects/gantt/types";
import type { TaskStatus } from "@/features/projects/types/api.types";
import type { PublicProjectSchedule, PublicScheduleItem } from "../api/portal.api";

// Espejo de las constantes del cronograma interno: una fila, una escala, un
// mismo lenguaje visual. Aquí cada fila es un ELEMENTO de la estructura (un
// componente/entregable), no una tarea; no hay columnas de personas.
const LABEL_W = 260;
const MIN_TRACK = 480;
const ROW_H = 36;
// Sangría por nivel de anidación, para que se lea la jerarquía del árbol.
const INDENT_STEP = 14;

const ZOOM_CFG: Record<"mes" | "semana" | "dia", { px: number; unit: TickUnit; label: string }> = {
  mes: { px: 6, unit: "month", label: "Mes" },
  semana: { px: 16, unit: "week", label: "Semana" },
  dia: { px: 36, unit: "day", label: "Día" },
};
type Zoom = keyof typeof ZOOM_CFG;

// Orden canónico de los estados para la leyenda (solo se muestran los presentes).
const STATUS_ORDER: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Cronograma del proyecto para el portal público del cliente: la ESTRUCTURA con
 * su tiempo, no las tareas. Cada fila es un componente/entregable con su barra
 * (rango agregado) y su avance; la jerarquía se navega colapsando padres.
 * Reutiliza la matemática del cronograma interno (timeline/metrics) y omite todo
 * lo sensible: sin responsables, equipos, cargos ni tareas individuales. Filtros
 * permitidos: estado, "solo en riesgo", zoom y búsqueda.
 */
export function ClientScheduleView({ schedule }: { schedule: PublicProjectSchedule }) {
  const items: PublicScheduleItem[] = schedule.items;

  const [zoom, setZoom] = useState<Zoom>("semana");
  const [statuses, setStatuses] = useState<Set<TaskStatus>>(() => new Set(STATUS_ORDER));
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Escala estable sobre TODOS los elementos: filtrar no debe "saltar" el eje.
  const range = useMemo(() => {
    const raw = computeRange(items);
    if (!raw) {
      return null;
    }
    const pad = Math.min(14, Math.max(2, Math.ceil(raw.totalDays * 0.04)));
    return padRange(raw, pad, pad + 1);
  }, [items]);

  // Mapas de jerarquía: padre de cada nodo y qué nodos tienen hijos (para el
  // chevron). Se derivan de `key`/`parent_key`, los índices opacos del backend.
  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>();
    items.forEach((it) => map.set(it.key, it.parent_key));
    return map;
  }, [items]);

  const hasChildren = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.parent_key) {
        set.add(it.parent_key);
      }
    });
    return set;
  }, [items]);

  // ¿Algún ancestro del nodo está colapsado? Entonces la fila se oculta.
  const ancestorCollapsed = useCallback(
    (key: string) => {
      let p = parentOf.get(key) ?? null;
      while (p) {
        if (collapsed.has(p)) {
          return true;
        }
        p = parentOf.get(p) ?? null;
      }
      return false;
    },
    [parentOf, collapsed],
  );

  // Estados presentes en la estructura (la leyenda no muestra opciones vacías).
  const presentStatuses = useMemo(
    () => STATUS_ORDER.filter((s) => items.some((it) => it.status === s)),
    [items],
  );

  // Filas visibles tras aplicar los filtros permitidos. Al buscar se ignora el
  // colapso (para que aparezcan las coincidencias aunque su padre esté cerrado).
  const rows = useMemo<PublicScheduleItem[]>(() => {
    const query = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!statuses.has(it.status)) {
        return false;
      }
      if (onlyAtRisk && !isOverdue(it, TODAY)) {
        return false;
      }
      if (query) {
        return it.name.toLowerCase().includes(query);
      }
      return !ancestorCollapsed(it.key);
    });
  }, [items, statuses, onlyAtRisk, search, ancestorCollapsed]);

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

  const trackWidth = range ? Math.max(MIN_TRACK, range.totalDays * ZOOM_CFG[zoom].px) : MIN_TRACK;
  const pxPerDay = range ? trackWidth / range.totalDays : 0;
  const pctToPx = (pct: number) => (pct / 100) * trackWidth;

  // Scroll horizontal: centrar "hoy" en el área visible al abrir el cronograma.
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

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-gold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de filtros permitidos (estado, búsqueda, riesgo, hoy, zoom) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Leyenda interactiva = filtro por estado (solo estados presentes) */}
        {presentStatuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {presentStatuses.map((s) => {
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
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Búsqueda por nombre del componente */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Buscar componente"
              aria-label="Buscar componente por nombre"
              className={cn(inputCls, "pl-7")}
            />
          </div>

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

      {items.length === 0 || !range ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
          <GanttChartSquare className="size-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            El cronograma aún no tiene componentes planificados.
            <br />
            Aparecerán aquí a medida que el equipo defina la estructura y sus fechas.
          </p>
        </div>
      ) : (
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
                  Estructura · {rows.length}
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
                      return null;
                    }
                    const centered = zoom === "dia";
                    return (
                      <span
                        key={t.key}
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] tabular-nums text-slate-400 dark:text-slate-500",
                          centered && "-translate-x-1/2",
                        )}
                        style={{ left: pctToPx(t.offsetPct) + (centered ? pxPerDay / 2 : 4) }}
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

              {rows.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="sticky left-0 px-4 text-sm italic text-slate-400 dark:text-slate-500">
                    No hay componentes que coincidan con los filtros.
                  </p>
                </div>
              ) : (
                rows.map((item) => {
                  const metrics = barMetrics(item, range);
                  const overdue = isOverdue(item, TODAY);
                  const progress = Math.max(0, Math.min(100, item.progress_pct));
                  const barLeft = pctToPx(metrics.offsetPct);
                  const barW = Math.max(10, pctToPx(metrics.widthPct));
                  const days = toDayNumber(item.due_date) - toDayNumber(item.start_date) + 1;
                  const dateLabel = `${shortDate(item.start_date)} – ${shortDate(item.due_date)} · ${days} d`;
                  const labelFitsRight = barLeft + barW + 150 <= trackWidth;
                  const isParent = hasChildren.has(item.key);
                  const isCollapsed = collapsed.has(item.key);
                  return (
                    <div
                      key={item.key}
                      className="group/row flex items-stretch border-b border-slate-50 last:border-b-0 dark:border-slate-900"
                      style={{ height: ROW_H }}
                    >
                      <div
                        style={{ width: LABEL_W }}
                        className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-white pr-2 text-left transition-colors group-hover/row:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:group-hover/row:bg-slate-900"
                      >
                        {/* Sangría por nivel + chevron si el componente tiene hijos */}
                        <div
                          className="flex min-w-0 flex-1 items-center gap-1.5"
                          style={{ paddingLeft: 8 + item.depth * INDENT_STEP }}
                        >
                          {isParent ? (
                            <button
                              type="button"
                              onClick={() => {
                                toggleCollapse(item.key);
                              }}
                              aria-expanded={!isCollapsed}
                              aria-label={isCollapsed ? "Expandir" : "Colapsar"}
                              className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <ChevronDown
                                className={cn(
                                  "size-3.5 transition-transform",
                                  isCollapsed && "-rotate-90",
                                )}
                              />
                            </button>
                          ) : (
                            <span className="w-3.5 shrink-0" aria-hidden />
                          )}
                          <span
                            className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[item.status])}
                          />
                          <p
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300",
                              isParent && "font-semibold text-slate-700 dark:text-slate-200",
                            )}
                          >
                            {item.name}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {progress}%
                        </span>
                      </div>
                      <div className="relative flex-1 transition-colors group-hover/row:bg-slate-50/60 dark:group-hover/row:bg-slate-900/40">
                        <div
                          title={[
                            item.name,
                            `${item.start_date} → ${item.due_date}`,
                            `${TASK_STATUS_LABELS[item.status]} · ${progress}%`,
                          ].join("\n")}
                          className={cn(
                            "absolute top-1/2 h-[18px] -translate-y-1/2 overflow-hidden rounded-[5px] shadow-sm transition",
                            STATUS_BAR_SOFT[item.status],
                            overdue && "ring-1 ring-rose-500",
                          )}
                          style={{ left: barLeft, width: barW }}
                        >
                          <span
                            className={cn("block h-full", STATUS_BAR_COLOR[item.status])}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
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
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientScheduleView;
