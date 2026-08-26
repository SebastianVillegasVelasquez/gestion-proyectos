import {
  Activity,
  CheckCircle2,
  MessageSquare,
  PlayCircle,
  Plus,
  RotateCcw,
  Send,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime } from "@/features/notifications/utils/notifications";
import { useProjectActivity } from "@/features/dashboard/hooks/use-dashboard-summary";
import type { ActivityKind } from "@/features/dashboard/types";

// Mismo diccionario semántico que el dashboard global: cada tipo de evento del
// historial de tareas se traduce a un verbo, un icono y un tono de color.
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
    verb: "envió a revisión",
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
};

export function ProjectActivityCard({ projectId }: { projectId: string }) {
  const activityQuery = useProjectActivity(projectId, 8);
  const items = activityQuery.data?.items ?? [];

  return (
    <Card className="flex flex-1 flex-col rounded-2xl">
      <CardContent className="flex h-full flex-col gap-3 py-5">
        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Activity className="size-[18px]" />
          </span>
          Actividad reciente
        </span>

        {activityQuery.isLoading ? (
          <div className="flex flex-col gap-2 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : activityQuery.isError ? (
          <p className="py-4 text-center text-sm text-rose-500">No se pudo cargar la actividad.</p>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <Activity className="size-7 text-muted-foreground/40" />
            <p className="text-sm italic text-muted-foreground">
              Aún no hay movimientos en este proyecto.
            </p>
          </div>
        ) : (
          <ul className="-mr-1 flex max-h-[320px] flex-col overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const meta = KIND_META[item.kind] ?? KIND_META.cambio_estado;
              const Icon = meta.icon;
              const actor = item.actor_name ?? "Alguien";
              const isLast = idx === items.length - 1;
              return (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* Línea vertical del timeline (conecta con el siguiente evento) */}
                  {!isLast && (
                    <span aria-hidden className="absolute bottom-0 left-4 top-9 w-px bg-border" />
                  )}
                  <span
                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${meta.tone}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-[13px] leading-snug text-foreground">
                      <span className="font-semibold">{actor}</span> {meta.verb}{" "}
                      <span className="font-medium">{item.task_title}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
