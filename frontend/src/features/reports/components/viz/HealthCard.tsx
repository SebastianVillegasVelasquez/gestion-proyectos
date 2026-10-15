import { cn } from "@/lib/utils";
import type { Health } from "../../api/analytics.api";

interface Segment {
  key: keyof Omit<Health, "total">;
  label: string;
  bar: string;
  dot: string;
}

const SEGMENTS: Segment[] = [
  { key: "completed", label: "Completadas", bar: "bg-brand-teal", dot: "bg-brand-teal" },
  { key: "on_track", label: "Al día", bar: "bg-stone-300 dark:bg-stone-600", dot: "bg-stone-300" },
  { key: "at_risk", label: "En riesgo", bar: "bg-orange-500", dot: "bg-orange-500" },
  { key: "overdue", label: "Vencidas", bar: "bg-brand-red", dot: "bg-brand-red" },
];

function share(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/** «Salud de las N tareas»: cuántas van al día y cuántas piden atención. */
export function HealthCard({ health }: { health: Health }) {
  const visible = SEGMENTS.filter((s) => health[s.key] > 0);
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        Salud de las {health.total} tareas
      </h3>
      <p className="text-sm text-muted-foreground">
        Cuántas están al día y cuántas requieren atención
      </p>

      <div
        className="mt-6 flex h-9 gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={SEGMENTS.map((s) => `${String(health[s.key])} ${s.label}`).join(", ")}
      >
        {visible.map((s) => (
          <div
            key={s.key}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", s.bar)}
            // Un mínimo para que un segmento pequeño no desaparezca.
            style={{ flexGrow: Math.max(health[s.key], health.total * 0.015), flexBasis: 0 }}
            title={`${s.label}: ${String(health[s.key])}`}
          />
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        {SEGMENTS.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-[3px]", s.dot)} />
              <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
                {health[s.key]}
              </span>
            </dt>
            <dd className="mt-1 text-sm text-foreground">{s.label}</dd>
            <dd className="text-xs text-muted-foreground">
              {share(health[s.key], health.total)}% del total
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
