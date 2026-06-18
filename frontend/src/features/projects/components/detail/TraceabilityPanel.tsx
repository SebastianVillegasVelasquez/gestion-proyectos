import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FilePlus2,
  History,
  type LucideIcon,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Undo2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import { useProjectTraceability } from "../../hooks/use-traceability";
import { TRACE_EVENT_LABELS, filterTraceabilityEvents } from "../../utils/traceability-events";
import { MOCK_TRACEABILITY } from "../../utils/traceability-mock";
import type { TraceabilityEvent, TraceabilityEventKind } from "../../types/api.types";

// Estilo por tipo de evento. El color comunica el significado de un vistazo
// (verde = entrega/aprobación, rojo = devolución). Los retrasos se pintan en
// rojo por encima de su tipo (ver más abajo).
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
};

const DELAY_META = {
  dot: "bg-rose-600",
  badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function formatDateTime(iso: string): string {
  const [date, time = ""] = iso.split("T");
  const [year, month, day] = date.split("-");
  const hhmm = time.slice(0, 5);
  return hhmm ? `${day}/${month}/${year} · ${hhmm}` : `${day}/${month}/${year}`;
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
  const dot = event.is_delay ? DELAY_META.dot : meta.dot;
  const badge = event.is_delay ? DELAY_META.badge : meta.badge;

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Punto + línea vertical */}
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm",
            dot,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="absolute top-7 h-full w-px bg-slate-200 dark:bg-slate-700" />
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

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {event.actor_name ?? "Sistema"}
          {event.old_status && event.new_status && (
            <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px]",
                  TASK_STATUS_COLORS[event.old_status],
                )}
              >
                {TASK_STATUS_LABELS[event.old_status]}
              </span>
              →
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
            “{event.change_reason}”
          </p>
        )}
      </div>
    </li>
  );
}

export function TraceabilityPanel({ projectId }: { projectId: string }) {
  const query = useProjectTraceability(projectId);
  const [onlyDelays, setOnlyDelays] = useState(false);
  // Vista previa con datos de ejemplo (no reales) para validar el diseño antes
  // de que la base de datos tenga historial real.
  const [preview, setPreview] = useState(false);

  const source = preview ? MOCK_TRACEABILITY : query.data;
  const events = useMemo(() => source?.events ?? [], [source]);
  const visible = useMemo(() => filterTraceabilityEvents(events, onlyDelays), [events, onlyDelays]);
  const summary = source?.summary;

  if (!preview && query.isLoading) {
    return <LoadingSkeleton rows={5} />;
  }
  if (!preview && query.isError) {
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
      {/* Aviso de datos de ejemplo */}
      {preview && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Sparkles className="size-4 shrink-0" />
          <span className="flex-1">
            Estás viendo <strong>datos de ejemplo</strong> (no reales) para previsualizar el diseño.
          </span>
          <button
            type="button"
            onClick={() => {
              setPreview(false);
            }}
            className="shrink-0 font-medium underline-offset-2 hover:underline"
          >
            Salir del ejemplo
          </button>
        </div>
      )}

      {/* Resumen */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
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
      </div>

      {/* Filtro: todos / solo retrasos */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <History className="size-4 text-blue-500" /> Línea de tiempo
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPreview((p) => !p);
            }}
            aria-pressed={preview}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
              preview
                ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300"
                : "border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Sparkles className="size-3.5" /> Datos de ejemplo
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(
              [
                { id: false, label: "Todos" },
                { id: true, label: "Solo retrasos" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={String(id)}
                type="button"
                onClick={() => {
                  setOnlyDelays(id);
                }}
                aria-pressed={onlyDelays === id}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  onlyDelays === id
                    ? id
                      ? "bg-rose-600 text-white"
                      : "bg-blue-600 text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <EmptyState
            icon={History}
            title="Sin eventos de trazabilidad"
            hint="Cuando se creen, asignen o entreguen tareas, el historial aparecerá aquí."
          />
          <button
            type="button"
            onClick={() => {
              setPreview(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
          >
            <Sparkles className="size-3.5" /> Ver datos de ejemplo
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Sin retrasos"
          hint="No hay eventos de retraso en este proyecto. ¡Buen ritmo!"
        />
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto pr-1">
          {visible.map((event) => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}
