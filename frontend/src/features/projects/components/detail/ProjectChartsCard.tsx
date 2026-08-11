import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { CalendarRange, ChartPie, ListChecks, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority } from "../../types/api.types";
import { deriveTaskMetrics, type StatusSegment } from "../../utils/task-metrics";
import {
  buildDeliveryBuckets,
  summarizeDelivery,
  type DeliveryBucket,
  type DeliveryGranularity,
} from "../../utils/delivery-metrics";

type View = "estado" | "desempeno";
type PriorityFilter = "todas" | TaskPriority;

// Orden y etiqueta de cada prioridad para el filtro del donut (de mayor a menor urgencia).
const PRIORITY_ORDER: TaskPriority[] = ["urgente", "alta", "media", "baja", "no_definida"];
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  no_definida: "Sin prioridad",
};

// Cuántos periodos se muestran según la granularidad elegida (desempeño).
const RANGE: Record<DeliveryGranularity, number> = { semana: 8, mes: 6 };
const ON_TIME_COLOR = "var(--color-brand-teal)";
const LATE_COLOR = "var(--color-brand-red)";

const TREND_META = {
  up: { icon: TrendingUp, label: "Mejorando", tone: "text-emerald-600 dark:text-emerald-400" },
  down: { icon: TrendingDown, label: "Empeorando", tone: "text-rose-600 dark:text-rose-400" },
  flat: { icon: Minus, label: "Estable", tone: "text-muted-foreground" },
};

function StatusTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: StatusSegment }[];
  total: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const seg = payload[0].payload;
  const pct = total ? Math.round((seg.count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
        <span className="font-semibold text-foreground">{seg.label}</span>
      </div>
      <p className="mt-1 text-muted-foreground">
        <span className="font-semibold text-foreground">{seg.count}</span>{" "}
        {seg.count === 1 ? "tarea" : "tareas"} · {pct}%
      </p>
    </div>
  );
}

// Sector activo del donut: crece un poco y suma un anillo exterior fino al hover.
function ActiveSlice(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={Number(outerRadius) + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Number(outerRadius) + 10}
        outerRadius={Number(outerRadius) + 13}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.35}
      />
    </g>
  );
}

function DeliveryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: DeliveryBucket }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const b = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
      {b.total === 0 ? (
        <p className="mt-1 text-muted-foreground">Sin entregas</p>
      ) : (
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ backgroundColor: ON_TIME_COLOR }} />
            {b.onTime} a tiempo
          </span>
          {b.late > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-sm" style={{ backgroundColor: LATE_COLOR }} />
              {b.late} tardía{b.late === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusView({ tasks }: { tasks: Task[] }) {
  const [priority, setPriority] = useState<PriorityFilter>("todas");
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const availablePriorities = useMemo(() => {
    const present = new Set(tasks.map((t) => t.priority));
    return PRIORITY_ORDER.filter((p) => present.has(p));
  }, [tasks]);

  const filtered = useMemo(
    () => (priority === "todas" ? tasks : tasks.filter((t) => t.priority === priority)),
    [tasks, priority],
  );
  const metrics = useMemo(() => deriveTaskMetrics(filtered), [filtered]);
  const segments = metrics.segments;

  return (
    <>
      {/* Filtro por prioridad, centrado */}
      {availablePriorities.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {(["todas", ...availablePriorities] as PriorityFilter[]).map((p) => {
            const label = p === "todas" ? "Todas" : PRIORITY_LABEL[p];
            const isActive = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPriority(p);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-brand-blue text-white"
                    : "bg-accent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {metrics.total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <ListChecks className="size-7 text-muted-foreground/40" />
          <p className="text-sm italic text-muted-foreground">
            {tasks.length === 0
              ? "Aún no hay tareas en este proyecto."
              : "No hay tareas con esa prioridad."}
          </p>
        </div>
      ) : (
        <>
          {/* Donut, centrado */}
          <div className="relative mx-auto h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={66}
                  outerRadius={96}
                  paddingAngle={segments.length > 1 ? 3 : 0}
                  cornerRadius={6}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={500}
                  activeIndex={activeIndex}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, index) => {
                    setActiveIndex(index);
                  }}
                  onMouseLeave={() => {
                    setActiveIndex(undefined);
                  }}
                >
                  {segments.map((seg) => (
                    <Cell key={seg.status} fill={seg.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<StatusTooltip total={metrics.total} />}
                  wrapperStyle={{ outline: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-semibold tabular-nums text-foreground">
                {activeIndex != null ? segments[activeIndex].count : metrics.progress}
                {activeIndex == null && <span className="text-xl text-muted-foreground">%</span>}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {activeIndex != null
                  ? segments[activeIndex].label
                  : `${metrics.total} ${metrics.total === 1 ? "tarea" : "tareas"}`}
              </span>
            </div>
          </div>

          {/* Leyenda, centrada en filas que se ajustan al ancho */}
          <ul className="flex w-full max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {segments.map((seg) => (
              <li key={seg.status} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-muted-foreground">{seg.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{seg.count}</span>
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  ({Math.round((seg.count / metrics.total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function DeliveryView({ tasks }: { tasks: Task[] }) {
  const [granularity, setGranularity] = useState<DeliveryGranularity>("semana");

  const buckets = useMemo(
    () => buildDeliveryBuckets(tasks, granularity, RANGE[granularity]),
    [tasks, granularity],
  );
  const summary = useMemo(() => summarizeDelivery(buckets), [buckets]);
  const trend = TREND_META[summary.trend];
  const TrendIcon = trend.icon;

  return (
    <>
      {/* Filtro de periodo, centrado */}
      <div className="flex items-center gap-1 rounded-lg bg-accent p-0.5">
        {(
          [
            { key: "semana", label: "Semanas" },
            { key: "mes", label: "Meses" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setGranularity(key);
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              granularity === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Resumen del rango visible, centrado */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl bg-accent/40 px-3.5 py-2.5 text-sm">
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {summary.totalDelivered}
          </span>
          <span className="text-xs text-muted-foreground">
            entregada{summary.totalDelivered === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {summary.onTimePct}%
          </span>
          <span className="text-xs text-muted-foreground">a tiempo</span>
        </span>
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", trend.tone)}>
          <TrendIcon className="size-3.5" />
          {trend.label}
        </span>
      </div>

      {summary.totalDelivered === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CalendarRange className="size-7 text-muted-foreground/40" />
          <p className="text-sm italic text-muted-foreground">
            Aún no hay entregas completadas en este rango.
          </p>
        </div>
      ) : (
        <div className="mx-auto h-[220px] w-full max-w-lg">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "var(--color-accent)", opacity: 0.5 }}
                content={<DeliveryTooltip />}
                wrapperStyle={{ outline: "none" }}
              />
              <Bar
                dataKey="onTime"
                name="A tiempo"
                stackId="entregas"
                fill={ON_TIME_COLOR}
                radius={[0, 0, 0, 0]}
                maxBarSize={32}
                animationDuration={500}
              />
              <Bar
                dataKey="late"
                name="Tardías"
                stackId="entregas"
                fill={LATE_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
                animationDuration={500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda, centrada */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: ON_TIME_COLOR }} />A
          tiempo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: LATE_COLOR }} />
          Tardías
        </span>
      </div>
    </>
  );
}

const VIEW_META: Record<View, { label: string; subtitle: string; icon: typeof ListChecks }> = {
  estado: { label: "Tareas por estado", subtitle: "Distribución del trabajo", icon: ListChecks },
  desempeno: {
    label: "Desempeño",
    subtitle: "Tareas completadas por periodo",
    icon: CalendarRange,
  },
};

/**
 * Un solo card con dos lecturas de las tareas: la distribución actual por
 * estado (donut) y el desempeño de entregas en el tiempo (barras). Se alternan
 * con un selector en la cabecera en vez de ocupar dos cards separados.
 */
export function ProjectChartsCard({ tasks }: { tasks: Task[] }) {
  const [view, setView] = useState<View>("estado");
  const meta = VIEW_META[view];
  const Icon = meta.icon;

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex h-full flex-col items-center gap-4 py-5">
        {/* Cabecera + selector de gráfico */}
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
              <Icon className="size-[18px]" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-foreground">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-accent p-0.5">
            {(
              [
                { key: "estado", icon: ChartPie, label: "Por estado" },
                { key: "desempeno", icon: CalendarRange, label: "Desempeño" },
              ] as const
            ).map(({ key, icon: TabIcon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setView(key);
                }}
                aria-label={label}
                title={label}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  view === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-4" />
              </button>
            ))}
          </div>
        </div>

        {view === "estado" ? <StatusView tasks={tasks} /> : <DeliveryView tasks={tasks} />}
      </CardContent>
    </Card>
  );
}
