import { cn } from "@/lib/utils";
import type { PlanProgress, PlanStatus } from "../../api/analytics.api";

/** «2026-10-14» -> «14/10/2026». */
function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** «2026-10-14» -> «14/10». */
function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const STATUS_BADGE: Record<PlanStatus, { dot: string; chip: string }> = {
  at_risk: {
    dot: "bg-brand-red",
    chip: "border-brand-red/30 bg-brand-red-light text-brand-red-dark dark:bg-brand-red/15 dark:text-brand-red",
  },
  watch: {
    dot: "bg-orange-500",
    chip: "border-orange-300/50 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  on_track: {
    dot: "bg-brand-teal",
    chip: "border-brand-teal/30 bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
  },
};

function badgeText(plan: PlanProgress): string {
  const gap = plan.gap_pts;
  if (plan.status === "on_track") {
    return gap < 0 ? `Al día · ${String(-gap)} pts sobre el plan` : "Al día";
  }
  const lead = plan.status === "at_risk" ? "En riesgo" : "Atención";
  return `${lead} · ${String(gap)} pts bajo el plan`;
}

function Bar({
  label,
  pct,
  detail,
  fill,
  valueClass,
}: {
  label: string;
  pct: number;
  detail: string;
  fill: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">
          <strong className={cn("font-semibold text-foreground", valueClass)}>{pct}%</strong>
          {" · "}
          {detail}
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", fill)}
          style={{ width: `${String(Math.min(Math.max(pct, 0), 100))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * «Avance frente al plan»: lo que el cronograma esperaba tener cerrado hoy contra
 * lo realmente completado, y dónde cae hoy dentro de la vida del proyecto.
 */
export function PlanProgressCard({ plan }: { plan: PlanProgress }) {
  const todayPct = Math.min(Math.max((plan.day_index / plan.total_days) * 100, 0), 100);
  const badge = STATUS_BADGE[plan.status];

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Avance frente al plan
          </h3>
          <p className="text-sm text-muted-foreground">
            Lo que el cronograma esperaba cerrar a hoy contra lo realmente completado
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold",
            badge.chip,
          )}
        >
          <span className={cn("size-2 rounded-full", badge.dot)} />
          {badgeText(plan)}
        </span>
      </header>

      <div className="mt-6 flex flex-col gap-5">
        <Bar
          label="Esperado a hoy"
          pct={plan.expected_pct}
          detail={`≈ ${String(plan.expected_tasks)} tareas`}
          fill="bg-gradient-to-r from-brand-gold/80 to-brand-gold"
        />
        <Bar
          label="Completado real"
          pct={plan.completed_pct}
          detail={`${String(plan.completed_tasks)} tareas`}
          fill="bg-brand-blue"
          valueClass="text-brand-blue-dark dark:text-brand-blue"
        />
      </div>

      <div className="mt-8" aria-label="Posición de hoy en el calendario del proyecto">
        <div className="relative h-5">
          <div className="absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute left-2 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand-blue"
            style={{ width: `calc((100% - 1rem) * ${String(todayPct / 100)})` }}
          />
          <span className="absolute left-0 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-brand-blue bg-card" />
          <span
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-brand-gold bg-brand-gold-dark/60 shadow"
            style={{ left: `calc(0.5rem + (100% - 1rem) * ${String(todayPct / 100)})` }}
          />
          <span className="absolute right-0 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-border bg-card" />
        </div>
        <div className="relative mt-2 flex items-start justify-between text-[13px]">
          <span>
            <strong className="font-semibold text-foreground">{fullDate(plan.window_start)}</strong>{" "}
            <span className="text-muted-foreground">· inicio</span>
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 text-center text-xs font-semibold text-brand-gold-dark sm:text-[13px]">
            Hoy {dayMonth(plan.today)} · día {plan.day_index} de {plan.total_days}
          </span>
          <span>
            <strong className="font-semibold text-foreground">{fullDate(plan.window_end)}</strong>{" "}
            <span className="text-muted-foreground">· cierre</span>
          </span>
        </div>
      </div>
    </section>
  );
}
