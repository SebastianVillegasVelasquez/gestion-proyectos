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
  filterTraceabilityEvents,
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

function formatDateTime(iso: string): string {
  const [date, timePart = ""] = iso.split("T");
  const [year, month, day] = date.split("-");
  const hhmm = timePart.slice(0, 5);
  return hhmm ? `${day}/${month}/${year} - ${hhmm}` : `${day}/${month}/${year}`;
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
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {formatDateTime(event.created_at)}
          </span>
        </div>

        <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
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

export function TraceabilityPanel({ projectId }: { projectId: string }) {
  const query = useProjectTraceability(projectId);
  // Un solo objeto de filtros en vez de un useState por control: así añadir un
  // filtro nuevo no obliga a tocar cada sitio que los combina.
  const [filters, setFilters] = useState<TraceabilityFilters>(EMPTY_TRACE_FILTERS);

  const events = useMemo(() => query.data?.events ?? [], [query.data]);
  const visible = useMemo(() => filterTraceabilityEvents(events, filters), [events, filters]);
  const teams = useMemo(() => teamsInTimeline(events), [events]);
  const summary = query.data?.summary;

  const patch = (change: Partial<TraceabilityFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
  };
  const isFiltered = filters.group !== "todos" || filters.teamId !== null || filters.search !== "";

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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

          {teams.length > 0 && (
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
        <div className="min-h-0 w-full max-w-3xl flex-1 overflow-y-auto pr-1">
          <Card className="rounded-2xl">
            <CardContent className="py-6">
              <ol>
                {visible.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
