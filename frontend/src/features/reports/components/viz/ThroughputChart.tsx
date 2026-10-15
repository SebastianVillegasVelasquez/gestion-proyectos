import type { WeekCount } from "../../api/analytics.api";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-03-09" -> "9 mar" */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d)} ${MONTHS[m - 1] ?? ""}`;
}

/**
 * Tareas completadas por semana (throughput). Una sola serie, así que no lleva
 * leyenda: el título la nombra. Cada barra trae su cifra encima y su semana
 * debajo, de modo que se lee igual en un móvil que en un monitor grande; la
 * altura crece con el ancho disponible.
 */
export function ThroughputChart({ weeks }: { weeks: WeekCount[] }) {
  if (weeks.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin datos.</p>;
  }
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const total = weeks.reduce((sum, w) => sum + w.count, 0);

  return (
    <div className="viz-root">
      <div className="relative h-52 sm:h-64 lg:h-72">
        {/* Guías horizontales a ¼, ½ y ¾ de la escala. */}
        {[25, 50, 75].map((pct) => (
          <div
            key={pct}
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${String(pct)}%`, borderColor: "var(--viz-grid)" }}
          />
        ))}
        <div
          className="absolute inset-0 flex items-end gap-1.5 border-b sm:gap-3"
          style={{ borderColor: "var(--viz-grid)" }}
        >
          {weeks.map((w) => (
            <div
              key={w.week_start}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              title={`Semana del ${shortDate(w.week_start)}: ${String(w.count)} completada${w.count === 1 ? "" : "s"}`}
            >
              <span className="mb-1 text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                {w.count}
              </span>
              <div
                className="w-full max-w-14 rounded-t-md transition-[height] duration-500"
                style={{
                  // 88 %: deja aire arriba para la cifra de la barra más alta.
                  height: `${String((w.count / max) * 88)}%`,
                  minHeight: w.count > 0 ? 3 : 0,
                  background: "var(--viz-s1)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-3">
        {weeks.map((w) => (
          <span
            key={w.week_start}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground sm:text-xs"
          >
            {shortDate(w.week_start)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {total} tarea{total === 1 ? "" : "s"} completada{total === 1 ? "" : "s"} en las últimas{" "}
        {weeks.length} semanas · semana que empieza el día indicado
      </p>
    </div>
  );
}
