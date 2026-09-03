import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  Flag,
  FolderOpen,
  FolderTree,
  History,
  type LucideIcon,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  Shuffle,
  TrendingUp,
  Undo2,
  User,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import { useProjectTraceability } from "../../hooks/use-traceability";
import {
  EMPTY_TRACE_FILTERS,
  TRACE_EVENT_LABELS,
  TRACE_FILTER_LABELS,
  type TraceFilterGroup,
  type TraceabilityFilters,
  type TraceabilityTally,
  actorTally,
  busiestTasks,
  eventKindTally,
  filterTraceabilityEvents,
  groupEventsByDay,
  teamsInTimeline,
} from "../../utils/traceability-events";
import type { TraceabilityEvent, TraceabilityEventKind } from "../../types/api.types";

const KIND_META: Record<TraceabilityEventKind, { icon: LucideIcon; dot: string; badge: string }> = {
  creacion: {
    icon: FilePlus2,
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  asignacion: {
    icon: UserPlus,
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  inicio: {
    icon: Play,
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  entrega: {
    icon: Send,
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  aprobacion: {
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  devolucion: {
    icon: Undo2,
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  cancelacion: {
    icon: Ban,
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  comentario: {
    icon: MessageSquare,
    dot: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  cambio_estado: {
    icon: RefreshCw,
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  equipo: {
    icon: UsersRound,
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  ubicacion: {
    icon: FolderTree,
    dot: "bg-brand-gold",
    badge: "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold",
  },
  reprogramacion: {
    icon: CalendarClock,
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  prioridad: {
    icon: Flag,
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const DELAY_META = {
  dot: "bg-rose-600",
  badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function formatTime(iso: string): string {
  return iso.split("T")[1]?.slice(0, 5) ?? "";
}

const DAY_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** «Hoy» / «Ayer» / «lunes, 4 de agosto de 2025» para la cabecera de cada día. */
function formatDayHeading(date: string, todayIso: string): string {
  if (date === todayIso) {
    return "Hoy";
  }
  const yesterday = new Date(`${todayIso}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) {
    return "Ayer";
  }
  return DAY_FORMATTER.format(new Date(`${date}T00:00:00`));
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">
            {value}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineEvent({ event }: { event: TraceabilityEvent }) {
  const meta = KIND_META[event.kind];
  const Icon = event.is_delay ? AlertTriangle : meta.icon;
  const badge = event.is_delay ? DELAY_META.badge : meta.badge;

  return (
    <li className="group relative flex gap-4 pb-5 last:pb-0">
      <div className="relative flex flex-col items-center">
        {/* Círculo de ícono tintado suave por tipo de evento (mismo mapeo que
            los badges) + conector vertical al siguiente evento. */}
        <span
          className={cn(
            "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
            badge,
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="absolute top-8 h-full w-px bg-border group-last:hidden" />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", badge)}>
            {event.is_delay ? "Retraso" : TRACE_EVENT_LABELS[event.kind]}
          </span>
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {formatTime(event.created_at)}
          </span>
        </div>

        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
          {event.task_title}
        </p>

        {(event.work_item_name ?? event.team_name) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {event.work_item_name && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <FolderOpen className="size-3 shrink-0" />
                {event.work_item_name}
              </span>
            )}
            {event.team_name && (
              <span className="flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-300">
                <UsersRound className="size-2.5 shrink-0" />
                {event.team_name}
              </span>
            )}
          </div>
        )}

        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <User className="size-3 shrink-0" />
            {event.actor_name ?? "Sistema"}
          </span>
          {event.assignee_name && event.assignee_name !== event.actor_name && (
            <span className="text-slate-300 dark:text-slate-600">&middot;</span>
          )}
          {event.assignee_name && event.assignee_name !== event.actor_name && (
            <span className="text-slate-400 dark:text-slate-500">
              {"responsable: "}
              {event.assignee_name}
            </span>
          )}
          {event.old_value && event.new_value && (
            <span className="inline-flex flex-wrap items-center gap-1 align-middle">
              <span className="text-slate-300 dark:text-slate-600">&middot;</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {event.old_value}
              </span>
              <ArrowRight className="size-3 shrink-0 text-slate-400" />
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {event.new_value}
              </span>
            </span>
          )}
          {event.old_status && event.new_status && (
            <span className="inline-flex flex-wrap items-center gap-1 align-middle">
              <span className="text-slate-300 dark:text-slate-600">&middot;</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px]",
                  TASK_STATUS_COLORS[event.old_status],
                )}
              >
                {TASK_STATUS_LABELS[event.old_status]}
              </span>
              <span className="text-slate-400">{">"}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px]",
                  TASK_STATUS_COLORS[event.new_status],
                )}
              >
                {TASK_STATUS_LABELS[event.new_status]}
              </span>
            </span>
          )}
        </p>

        {event.change_reason && (
          <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs italic text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            &ldquo;{event.change_reason}&rdquo;
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Bloque del panel lateral: un recuento con barra comparativa. La barra se
 * mide contra el valor más alto (no contra el total): lo que interesa es el
 * orden de magnitud entre filas, no el porcentaje exacto.
 */
function TallyList({
  title,
  icon: Icon,
  rows,
  barClass,
  empty,
}: {
  title: string;
  icon: LucideIcon;
  rows: TraceabilityTally[];
  barClass: string;
  empty: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="py-4">
        <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3.5" /> {title}
        </h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {rows.slice(0, 6).map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-foreground" title={row.label}>
                    {row.label}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", barClass)}
                    style={{ width: `${String(row.share)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Tareas donde se concentra el historial, con sus retrasos: el atajo a «¿dónde
 *  se está atascando el proyecto?» sin recorrer toda la línea de tiempo. */
function BusiestTasksCard({ events }: { events: TraceabilityEvent[] }) {
  const rows = useMemo(() => busiestTasks(events), [events]);
  return (
    <Card className="rounded-2xl">
      <CardContent className="py-4">
        <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Flag className="size-3.5" /> Tareas con más movimiento
        </h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Sin actividad todavía.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-foreground" title={row.title}>
                  {row.title}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {row.delays > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold tabular-nums text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                      {row.delays} ⏱
                    </span>
                  )}
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TraceabilityPanel({
  projectId,
  lockedTeamId,
}: {
  projectId: string;
  /** Cuando llega, la línea de tiempo queda fijada a ese equipo y se oculta el
   * selector de equipo: es la trazabilidad "de este equipo" embebida en su
   * panel, no la del proyecto entero. */
  lockedTeamId?: string;
}) {
  // Con equipo fijo (espacio de trabajo) la consulta se acota a ese equipo: el
  // backend la exige así para autorizar a líderes/supervisores de equipo que no
  // organizan el proyecto entero.
  const query = useProjectTraceability(projectId, lockedTeamId);
  // Un solo objeto de filtros en vez de un useState por control: así añadir un
  // filtro nuevo no obliga a tocar cada sitio que los combina.
  const [filters, setFilters] = useState<TraceabilityFilters>(EMPTY_TRACE_FILTERS);

  // Con equipo fijo el filtro de equipo se impone en cada render (sin efecto ni
  // estado espejo): así seguir al mismo panel entre equipos "simplemente
  // funciona".
  const activeFilters = useMemo(
    () => (lockedTeamId ? { ...filters, teamId: lockedTeamId } : filters),
    [filters, lockedTeamId],
  );

  const events = useMemo(() => query.data?.events ?? [], [query.data]);
  const visible = useMemo(
    () => filterTraceabilityEvents(events, activeFilters),
    [events, activeFilters],
  );
  const teams = useMemo(() => teamsInTimeline(events), [events]);
  const summary = query.data?.summary;

  // Todo lo agregado se calcula sobre lo VISIBLE, no sobre el total: si filtro
  // por un equipo, el desglose tiene que hablar de ese equipo.
  const byDay = useMemo(() => groupEventsByDay(visible), [visible]);
  const kindRows = useMemo(() => eventKindTally(visible), [visible]);
  const actorRows = useMemo(() => actorTally(visible), [visible]);
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const patch = (change: Partial<TraceabilityFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
  };
  // Con equipo fijo, ese filtro es intrínseco: no cuenta como "filtrado por el usuario".
  const isFiltered =
    filters.group !== "todos" ||
    (!lockedTeamId && filters.teamId !== null) ||
    filters.search !== "";

  if (query.isLoading) {
    return <LoadingSkeleton rows={5} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="No se pudo cargar la trazabilidad"
        hint="Hubo un problema al obtener el historial del proyecto."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    // Un solo desplazamiento, el de este panel: sirve igual dentro del shell de
    // proyecto (que recorta el alto) y dentro del espacio de equipo.
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          icon={History}
          label="Eventos"
          value={summary?.total_events ?? 0}
          tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Retrasos"
          value={summary?.delays ?? 0}
          tone="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Entregas"
          value={summary?.deliveries ?? 0}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
        />
        <SummaryCard
          icon={Undo2}
          label="Devoluciones"
          value={summary?.returns ?? 0}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <SummaryCard
          icon={CalendarClock}
          label="Reprogramaciones"
          value={summary?.reschedules ?? 0}
          tone="bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold"
        />
        <SummaryCard
          icon={Shuffle}
          label="Cambios de manos"
          value={summary?.reassignments ?? 0}
          tone="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <History className="size-4 text-brand-teal" /> Línea de tiempo
          {isFiltered && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {visible.length} de {events.length}
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => {
                patch({ search: e.target.value });
              }}
              placeholder="Tarea o persona…"
              aria-label="Buscar en la línea de tiempo"
              className="h-8 w-44 rounded-lg border border-border bg-card pl-8 pr-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-teal"
            />
          </div>

          {!lockedTeamId && teams.length > 0 && (
            <select
              value={filters.teamId ?? ""}
              onChange={(e) => {
                patch({ teamId: e.target.value || null });
              }}
              aria-label="Filtrar por equipo"
              className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none transition-colors focus:border-brand-teal"
            >
              <option value="">Todos los equipos</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {(Object.keys(TRACE_FILTER_LABELS) as TraceFilterGroup[]).map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => {
                  patch({ group });
                }}
                aria-pressed={filters.group === group}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.group === group
                    ? group === "retrasos"
                      ? "bg-rose-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                {TRACE_FILTER_LABELS[group]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin eventos de trazabilidad"
          hint="Cuando se creen, asignen, muevan o entreguen tareas, el historial aparecerá aquí."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Ningún evento coincide"
          hint="Prueba con otro filtro o limpia la búsqueda."
        />
      ) : (
        // Dos columnas a partir de xl: la línea de tiempo ocupa el ancho útil y
        // el resto de la pantalla —que antes quedaba en blanco— se gana con la
        // lectura agregada del mismo conjunto filtrado. Por debajo de xl los
        // paneles pasan debajo, no se aprietan.
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0" role="region" aria-label="Línea de tiempo">
            <Card className="rounded-2xl">
              <CardContent className="py-5">
                {byDay.map((day) => (
                  <section key={day.date}>
                    <h3 className="sticky top-0 z-20 -mx-2 mb-3 flex items-baseline gap-2 bg-card/95 px-2 py-1.5 backdrop-blur">
                      <span className="text-[12px] font-semibold capitalize text-foreground">
                        {formatDayHeading(day.date, todayIso)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {day.events.length} {day.events.length === 1 ? "evento" : "eventos"}
                      </span>
                    </h3>
                    <ol className="mb-4 last:mb-0">
                      {day.events.map((event) => (
                        <TimelineEvent key={event.id} event={event} />
                      ))}
                    </ol>
                  </section>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="flex flex-col gap-3 xl:sticky xl:top-0">
            <TallyList
              title="Qué está pasando"
              icon={History}
              rows={kindRows}
              barClass="bg-brand-teal"
              empty="Sin eventos."
            />
            <TallyList
              title="Quién mueve el proyecto"
              icon={User}
              rows={actorRows}
              barClass="bg-brand-gold"
              empty="Sin actividad registrada."
            />
            <BusiestTasksCard events={visible} />
          </aside>
        </div>
      )}
    </div>
  );
}
