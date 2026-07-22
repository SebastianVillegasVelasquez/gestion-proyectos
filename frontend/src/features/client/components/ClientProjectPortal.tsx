import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  Loader2,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { portalApi, type PublicProjectProgress } from "../api/portal.api";

const STATUS_META: Record<PublicProjectProgress["status"], { label: string; badge: string }> = {
  active: {
    label: "En marcha",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  "in-review": {
    label: "En revisión",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  "at-risk": {
    label: "Requiere atención",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none text-slate-900 dark:text-slate-50">
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function ClientProjectPortal() {
  const { token = "" } = useParams<{ token: string }>();

  const query = useQuery({
    queryKey: ["public-project", token],
    queryFn: () => portalApi.getProgress(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
        <header className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Bitácora OBJ · Portal del cliente
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seguimiento de tu proyecto en tiempo real
            </p>
          </div>
        </header>

        {query.isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="size-6 animate-spin text-slate-300" />
          </div>
        ) : query.isError || !query.data ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <FolderKanban className="size-6" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Enlace no válido o expirado
            </p>
            <p className="max-w-sm text-sm text-slate-400 dark:text-slate-500">
              Este enlace de seguimiento no es correcto o fue revocado. Solicita uno nuevo al equipo
              del proyecto.
            </p>
          </div>
        ) : (
          <Portal data={query.data} />
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">
          Vista de solo lectura · La información se actualiza a medida que el equipo avanza.
        </p>
      </div>
    </div>
  );
}

function Portal({ data }: { data: PublicProjectProgress }) {
  const status = STATUS_META[data.status];
  const progress = Math.round(data.progress_pct);

  return (
    <>
      {/* Encabezado del proyecto */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {data.name}
            </h1>
            {(data.client_name ?? data.coordinator) && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {data.client_name}
                {data.client_name && data.coordinator && " · "}
                {data.coordinator && `Coordina: ${data.coordinator}`}
              </p>
            )}
          </div>
          <span
            className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", status.badge)}
          >
            {status.label}
          </span>
        </div>

        {/* Barra de avance general */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Avance general
            </span>
            <span className="text-2xl font-bold text-brand-gold-dark dark:text-brand-gold">
              {progress}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {data.tasks_completed} de {data.tasks_total} tareas completadas
          </p>
        </div>
      </section>

      {/* Desglose por estado */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={CheckCircle2}
          label="Completadas"
          value={data.tasks_completed}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
        />
        <Stat
          icon={Loader2}
          label="En revisión"
          value={data.tasks_in_review}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <Stat
          icon={ListTodo}
          label="Por hacer"
          value={data.tasks_pending}
          tone="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        />
        <Stat
          icon={data.tasks_overdue > 0 ? AlertTriangle : CalendarClock}
          label="Vencidas"
          value={data.tasks_overdue}
          tone={
            data.tasks_overdue > 0
              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }
        />
      </section>
    </>
  );
}

export default ClientProjectPortal;
