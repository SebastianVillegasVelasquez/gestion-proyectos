import type { AnalyticsOverview } from "../../api/analytics.api";

interface Slice {
  status: string;
  label: string;
  /** Color del trazo del anillo y del punto de la leyenda. */
  color: string;
}

// Orden del flujo de trabajo: de lo terminado a lo que aún no empieza.
const SLICES: Slice[] = [
  { status: "completada", label: "Completadas", color: "var(--brand-teal)" },
  { status: "en_progreso", label: "En progreso", color: "var(--brand-blue)" },
  { status: "en_revision", label: "En revisión", color: "var(--brand-gold)" },
  { status: "devuelta", label: "Devueltas", color: "#e0832e" },
  { status: "pendiente_por_iniciar", label: "Por iniciar", color: "#d6d3d1" },
  { status: "cancelada", label: "Canceladas", color: "#a8a29e" },
];

const R = 54;
const C = 2 * Math.PI * R;

/** «Distribución por estado»: el flujo de trabajo actual como anillo + leyenda. */
export function StatusDonut({ overview }: { overview: AnalyticsOverview }) {
  const total = overview.total_tasks;
  const slices = SLICES.map((s) => ({ ...s, count: overview.by_status[s.status] ?? 0 })).filter(
    (s) => s.count > 0,
  );

  // Cada arco empieza donde acaba el anterior.
  const lengths = slices.map((s) => (total > 0 ? (s.count / total) * C : 0));
  const arcs = slices.map((s, i) => ({
    ...s,
    length: lengths[i],
    offset: lengths.slice(0, i).reduce((sum, n) => sum + n, 0),
  }));

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        Distribución por estado
      </h3>
      <p className="text-sm text-muted-foreground">Flujo de trabajo actual</p>

      {total === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Sin tareas.</p>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="relative size-40 shrink-0">
            <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img">
              <title>Distribución de las tareas por estado</title>
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--muted)" strokeWidth="14" />
              {arcs.map((a) => (
                <circle
                  key={a.status}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="14"
                  // Un hilo de aire entre arcos para que se distingan sin leyenda.
                  strokeDasharray={`${String(Math.max(a.length - 1.5, 0.5))} ${String(C)}`}
                  strokeDashoffset={-a.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {overview.progress_pct}%
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Completado
              </span>
            </div>
          </div>

          <ul className="min-w-[200px] flex-1 space-y-2.5">
            {slices.map((s) => (
              <li key={s.status} className="flex items-center gap-3 text-[15px]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 text-foreground">{s.label}</span>
                <span className="w-12 text-right font-semibold tabular-nums text-foreground">
                  {s.count}
                </span>
                <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                  {Math.round((s.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
