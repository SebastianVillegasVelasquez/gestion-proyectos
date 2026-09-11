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
import {
  CalendarRange,
  ChartPie,
  ListChecks,
  Minus,
  PackageCheck,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/common/Skeleton";
import type { Task, TaskPriority } from "../../types/api.types";
import { deriveTaskMetrics } from "../../utils/task-metrics";
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
// Colores de marca con respaldo HEX (mismo criterio que el gráfico de
// rendimiento de Equipos de trabajo): las CSS vars no resuelven dentro del SVG
// de recharts en algunos navegadores.
const ON_TIME_COLOR = "var(--color-brand-teal, #4da0b1)";
const LATE_COLOR = "var(--color-brand-red, #c4573a)";

const TREND_META = {
  up: {
    icon: TrendingUp,
    label: "Mejora",
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  down: {
    icon: TrendingDown,
    label: "Empeora",
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  flat: {
    icon: Minus,
    label: "Estable",
    tile: "bg-accent text-muted-foreground",
  },
};

// Píldora de filtro: mismo patrón que Equipos de trabajo (rounded-full, activo
// en teal). Se usa en el filtro de prioridad y en el de periodo.
const pillClass = (active: boolean) =>
  cn(
    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
    active ? "bg-brand-teal text-white" : "bg-accent text-muted-foreground hover:text-foreground",
  );

// Tarjeta de cifra: calcada de `StatTile` de Equipos de trabajo (borde + cuadro
// de icono tintado + valor grande + etiqueta pequeña).
function StatTile({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight tabular-nums text-foreground">
          {value}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
      </span>
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
            <span className="size-2 rounded-full" style={{ backgroundColor: ON_TIME_COLOR }} />
            {b.onTime} a tiempo
          </span>
          {b.late > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: LATE_COLOR }} />
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

  // Sector bajo el cursor: su detalle se lee en el hueco del donut, no en un
  // letrero flotante que seguiría al ratón por encima del propio anillo.
  const active = activeIndex != null ? segments[activeIndex] : null;
  const activePct = active && metrics.total ? Math.round((active.count / metrics.total) * 100) : 0;

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
                className={pillClass(isActive)}
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
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-11 text-center">
              {active ? (
                <>
                  <span className="text-4xl font-semibold tabular-nums text-foreground">
                    {active.count}
                  </span>
                  <span
                    className="mt-0.5 line-clamp-2 text-[11px] font-semibold uppercase leading-tight tracking-wider"
                    style={{ color: active.color }}
                  >
                    {active.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {active.count === 1 ? "tarea" : "tareas"} · {activePct}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-semibold tabular-nums text-foreground">
                    {metrics.progress}
                    <span className="text-xl text-muted-foreground">%</span>
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {metrics.total} {metrics.total === 1 ? "tarea" : "tareas"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Leyenda como chips tintados, igual que las etiquetas de tipo de la
              Estructura: punto de color + fondo suave del propio estado. */}
          <ul className="flex w-full max-w-md flex-wrap items-center justify-center gap-2">
            {segments.map((seg) => (
              <li
                key={seg.status}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  seg.soft,
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span>{seg.label}</span>
                <span className="font-semibold tabular-nums">{seg.count}</span>
                <span className="tabular-nums opacity-70">
                  {Math.round((seg.count / metrics.total) * 100)}%
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
      {/* Filtro de periodo: mismas píldoras que Equipos de trabajo */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
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
            className={pillClass(granularity === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Resumen del rango visible como tarjetas de cifra (calcadas de Equipos) */}
      <div className="grid w-full max-w-lg grid-cols-3 gap-3">
        <StatTile
          Icon={PackageCheck}
          value={String(summary.totalDelivered)}
          label={`entregada${summary.totalDelivered === 1 ? "" : "s"}`}
          tone="bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal"
        />
        <StatTile
          Icon={Target}
          value={`${String(summary.onTimePct)}%`}
          label="a tiempo"
          tone="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold"
        />
        <StatTile Icon={TrendIcon} value={trend.label} label="tendencia" tone={trend.tile} />
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

      {/* Leyenda como chips tintados, igual que la vista por estado */}
      <div className="flex items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-medium text-brand-teal-dark dark:text-brand-teal">
          <span className="size-2 rounded-full" style={{ backgroundColor: ON_TIME_COLOR }} />A
          tiempo
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-brand-red/10 px-2.5 py-1 text-xs font-medium text-brand-red-dark dark:text-brand-red">
          <span className="size-2 rounded-full" style={{ backgroundColor: LATE_COLOR }} />
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
export function ProjectChartsCard({
  tasks,
  loading = false,
}: {
  tasks: Task[];
  /** Las tareas aún no llegaron: la tarjeta se dibuja igual, con su hueco. */
  loading?: boolean;
}) {
  const [view, setView] = useState<View>("estado");
  const meta = VIEW_META[view];
  const Icon = meta.icon;

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex h-full flex-col items-center gap-4 py-5 sm:pt-5">
        {/* Cabecera + selector de gráfico */}
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal">
              <Icon className="size-[18px]" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-foreground">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
                aria-pressed={view === key}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors",
                  view === key
                    ? "bg-brand-teal text-white"
                    : "bg-accent text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-4" />
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          // El hueco imita la forma del gráfico (aro + leyenda) para que al
          // llegar los datos nada se mueva de sitio.
          <div className="flex w-full flex-1 items-center justify-center gap-8 py-6">
            <Skeleton className="size-36 rounded-full" />
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-3.5 w-28" />
              ))}
            </div>
          </div>
        ) : (
          // Al montar, el contenido entra con un fundido corto: se percibe que
          // el dato llegó sin hacer esperar a quien ya sabe lo que busca.
          <div className="flex w-full flex-1 flex-col items-center animate-in fade-in-0 duration-500 motion-reduce:animate-none">
            {view === "estado" ? <StatusView tasks={tasks} /> : <DeliveryView tasks={tasks} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
