import { useMemo, useState } from "react";
import type { SeriesPoint } from "../../api/analytics.api";

/** "2026-03-09" -> "9 mar" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${String(d)} ${months[m - 1] ?? ""}`;
}

/**
 * Burn-up: tareas completadas acumuladas (real) frente al ritmo ideal (plan)
 * a lo largo del proyecto. Una sola escala Y. La serie real es la coloreada;
 * la ideal es una línea de referencia discontinua, distinguida por el trazo y
 * la leyenda, no solo por el color.
 */
export function BurnupChart({ points, scope }: { points: SeriesPoint[]; scope: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxY = Math.max(scope, ...points.map((p) => Math.max(p.ideal, p.actual)), 1);
  const n = points.length;

  const path = useMemo(() => {
    const line = (key: "ideal" | "actual") =>
      points
        .map((p, i) => {
          const x = n <= 1 ? 0 : (i / (n - 1)) * 100;
          const y = 100 - (p[key] / maxY) * 100;
          return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
    return { ideal: line("ideal"), actual: line("actual") };
  }, [points, n, maxY]);

  if (n === 0) {
    return <p className="text-xs text-muted-foreground">Sin datos en el rango.</p>;
  }

  const hp = hover != null ? points[hover] : null;
  const hoverLeftPct = n <= 1 || hover == null ? 50 : (hover / (n - 1)) * 100;

  return (
    <div className="viz-root">
      <div className="mb-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: "var(--viz-s1)" }} />
          Real
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: "var(--viz-ink-soft)" }}
          />
          Plan (ideal)
        </span>
      </div>

      <div
        className="relative h-52 w-full"
        onMouseLeave={() => {
          setHover(null);
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          setHover(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--viz-grid)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={path.ideal}
            fill="none"
            stroke="var(--viz-ink-soft)"
            strokeWidth={2}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path.actual}
            fill="none"
            stroke="var(--viz-s1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {hover != null && n > 1 && (
            <line
              x1={(hover / (n - 1)) * 100}
              x2={(hover / (n - 1)) * 100}
              y1="0"
              y2="100"
              stroke="var(--viz-ink-soft)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Eje Y (referencia) */}
        <span className="absolute -left-1 top-0 -translate-x-full text-[10px] tabular-nums text-muted-foreground">
          {maxY}
        </span>
        <span className="absolute -left-1 bottom-0 -translate-x-full text-[10px] tabular-nums text-muted-foreground">
          0
        </span>

        {hp && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-sm"
            style={{ left: `${hoverLeftPct.toFixed(2)}%`, top: 0 }}
          >
            <div className="font-medium text-foreground">{shortDate(hp.date)}</div>
            <div className="text-muted-foreground">
              Real <span className="tabular-nums text-foreground">{hp.actual}</span> · Plan{" "}
              <span className="tabular-nums text-foreground">{Math.round(hp.ideal)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points[n - 1].date)}</span>
      </div>
    </div>
  );
}
