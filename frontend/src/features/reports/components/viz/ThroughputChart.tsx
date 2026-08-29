import { useState } from "react";
import type { WeekCount } from "../../api/analytics.api";

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
 * Tareas completadas por semana (throughput). Una sola serie -> sin leyenda,
 * el título la nombra. Magnitud: barras desde la línea base.
 */
export function ThroughputChart({ weeks }: { weeks: WeekCount[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const n = weeks.length;
  if (n === 0) {
    return <p className="text-xs text-muted-foreground">Sin datos.</p>;
  }
  const slot = 100 / n;
  const barW = slot * 0.62;

  return (
    <div className="viz-root">
      <div className="relative h-40 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <line
            x1="0"
            x2="100"
            y1="100"
            y2="100"
            stroke="var(--viz-grid)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {weeks.map((w, i) => {
            const h = (w.count / max) * 96;
            return (
              <rect
                key={w.week_start}
                x={i * slot + (slot - barW) / 2}
                y={100 - h}
                width={barW}
                height={Math.max(h, w.count > 0 ? 1 : 0)}
                fill="var(--viz-s1)"
                opacity={hover == null || hover === i ? 1 : 0.55}
                onMouseEnter={() => {
                  setHover(i);
                }}
                onMouseLeave={() => {
                  setHover(null);
                }}
              />
            );
          })}
        </svg>
        <span className="absolute -left-1 top-0 -translate-x-full text-[10px] tabular-nums text-muted-foreground">
          {max}
        </span>

        {hover != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-sm"
            style={{ left: `${((hover + 0.5) * slot).toFixed(2)}%`, top: 0 }}
          >
            <div className="font-medium text-foreground">
              Semana del {shortDate(weeks[hover].week_start)}
            </div>
            <div className="tabular-nums text-muted-foreground">
              {weeks[hover].count} completada{weeks[hover].count === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{shortDate(weeks[0].week_start)}</span>
        <span>{shortDate(weeks[n - 1].week_start)}</span>
      </div>
    </div>
  );
}
