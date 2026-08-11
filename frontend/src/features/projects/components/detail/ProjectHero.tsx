import { cn } from "@/lib/utils";
import type { Project } from "../../types/api.types";
import type { ProjectStatus, TaskMetrics } from "../../utils/task-metrics";

// Días restantes hasta el cierre respecto a HOY, ya redactado. Da el eje temporal
// que acompaña al badge de estado en el hero.
function daysHint(endDate: string | null, progress: number): string | null {
  if (!endDate) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (progress >= 100) {
    return "Trabajo completado";
  }
  if (days < 0) {
    return `Vencido hace ${Math.abs(days)} d`;
  }
  if (days === 0) {
    return "Cierra hoy";
  }
  return `Faltan ${days} día${days === 1 ? "" : "s"}`;
}

// Badge de estado con estilo para fondo oscuro (el hero es oscuro).
const STATUS_HERO: Record<ProjectStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: "A tiempo",
    className: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
    dot: "bg-emerald-400",
  },
  "at-risk": {
    label: "En riesgo",
    className: "bg-rose-400/15 text-rose-200 ring-rose-300/30",
    dot: "bg-rose-400",
  },
  "in-review": {
    label: "En revisión",
    className: "bg-amber-400/15 text-amber-100 ring-amber-300/30",
    dot: "bg-amber-400",
  },
};

function HeroMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          danger ? "text-rose-300" : "text-white",
        )}
      >
        {value}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</span>
    </div>
  );
}

/**
 * Franja "hero" de estado del proyecto: en una sola fila muestra el % de avance,
 * el conteo de tareas, las métricas rápidas y el badge de estado con los días
 * restantes. Debajo, una barra de progreso delgada a todo el ancho. Es el único
 * bloque con degradado decorativo del tablero.
 */
export function ProjectHero({ project, metrics }: { project: Project; metrics: TaskMetrics }) {
  const status = STATUS_HERO[metrics.status];
  const remaining = Math.max(metrics.total - metrics.completed, 0);
  const hint = daysHint(project.end_date, metrics.progress);

  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-5 bg-gradient-to-br from-brand-black via-brand-surface to-brand-gold-dark px-6 py-5 text-white lg:flex-row lg:items-center lg:gap-7">
        {/* Progreso grande + conteo */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-semibold leading-none tabular-nums">
            {metrics.progress}
            <span className="text-2xl text-white/50">%</span>
          </span>
          <span className="text-sm text-white/55">
            {metrics.completed} de {metrics.total} {metrics.total === 1 ? "tarea" : "tareas"}
          </span>
        </div>

        {/* Separador vertical */}
        <div className="hidden h-12 w-px bg-white/15 lg:block" />

        {/* Métricas rápidas */}
        <div className="flex items-center gap-7">
          <HeroMetric label="Completadas" value={metrics.completed} />
          <HeroMetric label="Restantes" value={remaining} />
          <HeroMetric label="Atrasadas" value={metrics.overdue} danger={metrics.overdue > 0} />
        </div>

        {/* Estado + días restantes, a la derecha */}
        <div className="flex items-center gap-3 lg:ml-auto">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset",
              status.className,
            )}
          >
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {hint && <span className="text-xs font-medium text-white/60">{hint}</span>}
        </div>
      </div>

      {/* Barra de progreso delgada, a todo el ancho */}
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-brand-gold to-brand-teal transition-all duration-500"
          style={{ width: `${metrics.progress}%` }}
        />
      </div>
    </section>
  );
}
