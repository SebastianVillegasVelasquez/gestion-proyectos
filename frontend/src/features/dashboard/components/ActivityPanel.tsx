import { useState } from "react";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  FolderTree,
  MessageSquare,
  PlayCircle,
  Plus,
  RotateCcw,
  Send,
  UserPlus,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/features/notifications/utils/notifications";
import { useMyTeamActivity, useRecentActivity } from "../hooks/use-dashboard-summary";
import type { ActivityItem, ActivityKind } from "../types";

// Cuántos eventos se ven plegado / desplegado (el backend trae hasta 10).
const COLLAPSED = 5;
const EXPANDED = 10;

// Cada tipo de evento del historial de tareas se traduce a un verbo, un icono y
// un color. La fuente de los tipos es el dominio de trazabilidad del backend.
const KIND_META: Record<ActivityKind, { verb: string; icon: LucideIcon; tone: string }> = {
  creacion: { verb: "creó la tarea", icon: Plus, tone: "bg-brand-blue/10 text-brand-blue" },
  asignacion: {
    verb: "reasignó la tarea",
    icon: UserPlus,
    tone: "bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal",
  },
  inicio: {
    verb: "inició la tarea",
    icon: PlayCircle,
    tone: "bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal",
  },
  entrega: {
    verb: "entregó la tarea",
    icon: Send,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  aprobacion: {
    verb: "aprobó la tarea",
    icon: CheckCircle2,
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  devolucion: {
    verb: "devolvió la tarea",
    icon: RotateCcw,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  cancelacion: {
    verb: "canceló la tarea",
    icon: XCircle,
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  comentario: {
    verb: "comentó en la tarea",
    icon: MessageSquare,
    tone: "bg-brand-blue/10 text-brand-blue",
  },
  cambio_estado: {
    verb: "actualizó la tarea",
    icon: Activity,
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  equipo: {
    verb: "cambió de equipo la tarea",
    icon: UsersRound,
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  ubicacion: {
    verb: "movió de ubicación la tarea",
    icon: FolderTree,
    tone: "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold",
  },
  reprogramacion: {
    verb: "movió las fechas de la tarea",
    icon: CalendarClock,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  prioridad: {
    verb: "cambió la prioridad de la tarea",
    icon: Flag,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = KIND_META[item.kind] ?? KIND_META.cambio_estado;
  const Icon = meta.icon;
  const actor = item.actor_name ?? "El sistema";

  return (
    <div className="flex items-start gap-3 rounded-md p-2 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-snug text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-slate-900 dark:text-slate-50">{actor}</span>{" "}
          {meta.verb}{" "}
          <span className="font-medium text-slate-800 dark:text-slate-100">{item.task_title}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          {item.project_name && <span className="truncate">{item.project_name}</span>}
          {item.project_name && <span aria-hidden>·</span>}
          <span className="shrink-0">{formatRelativeTime(item.created_at)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Cuerpo reutilizable del panel de actividad: recibe los eventos ya cargados y
 * los pinta (skeleton / error / vacío / lista con "ver más"). Lo comparten el
 * panel global del dashboard admin y el de "mis equipos" del líder, que solo se
 * diferencian en la fuente de datos y el texto.
 */
function ActivityCard({
  title,
  items,
  isLoading,
  isError,
  emptyHint,
}: {
  title: string;
  items: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
  emptyHint: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items.slice(0, EXPANDED) : items.slice(0, COLLAPSED);
  const hasMore = items.length > COLLAPSED;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {isLoading ? (
          <div className="flex flex-col gap-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : isError ? (
          <p className="py-3 text-center text-[12px] text-rose-500">
            No se pudo cargar la actividad.
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <Activity className="size-5" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aún no hay movimientos
            </p>
            <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{emptyHint}</p>
          </div>
        ) : (
          <>
            {visible.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => {
                  setExpanded((v) => !v);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
              >
                {expanded ? "Ver menos" : "Ver más"}
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Actividad reciente del sistema: los últimos eventos del historial de tareas
 * (creación, entrega, aprobación, devolución…) de todos los proyectos. Muestra
 * los primeros 5 y despliega hasta 10. Fuente: GET /dashboard/activity.
 */
export function ActivityPanel() {
  const activityQuery = useRecentActivity(EXPANDED);
  return (
    <ActivityCard
      title="Actividad reciente"
      items={activityQuery.data?.items ?? []}
      isLoading={activityQuery.isLoading}
      isError={activityQuery.isError}
      emptyHint="Aquí verás las acciones recientes: creación, entrega y aprobación de tareas."
    />
  );
}

/**
 * Actividad reciente ACOTADA a los equipos que el usuario lidera: el dashboard
 * del líder (rol User) no ve el pulso global, pero sí el de lo suyo. Fuente:
 * GET /dashboard/me/activity — vacío si no lidera ningún equipo.
 */
export function MyTeamActivityPanel() {
  const activityQuery = useMyTeamActivity(EXPANDED);
  return (
    <ActivityCard
      title="Actividad de mis equipos"
      items={activityQuery.data?.items ?? []}
      isLoading={activityQuery.isLoading}
      isError={activityQuery.isError}
      emptyHint="Cuando alguien de tus equipos cree, entregue o avance una tarea, lo verás aquí."
    />
  );
}
