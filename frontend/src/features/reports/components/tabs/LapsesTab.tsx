import type { DeliveryLapse } from "../../api/analytics.api";
import { path } from "../../utils/format";
import "../viz/viz.css";

export function LapsesTab({ rows }: { rows: DeliveryLapse[] }) {
  const max = Math.max(...rows.map((r) => r.total_bdays), 1);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin entregas registradas en este filtro.</p>
    );
  }
  return (
    <div className="viz-root flex flex-col gap-3">
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--viz-s1)" }} />
          Producción
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--viz-s2)" }} />
          Revisión
        </span>
        <span>· días laborables</span>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => (
          <div key={r.task_id} className="flex flex-col gap-1.5 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground">{r.task_title}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {path(r.element_path)} · {r.versions} versión{r.versions === 1 ? "" : "es"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-3 flex-1 overflow-hidden rounded bg-muted">
                <div
                  style={{
                    width: `${(r.production_bdays / max) * 100}%`,
                    background: "var(--viz-s1)",
                  }}
                  title={`Producción: ${String(r.production_bdays)} d`}
                />
                <div
                  style={{
                    width: `${(r.review_bdays / max) * 100}%`,
                    background: "var(--viz-s2)",
                    marginLeft: r.production_bdays && r.review_bdays ? 2 : 0,
                  }}
                  title={`Revisión: ${String(r.review_bdays)} d`}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {r.production_bdays} + {r.review_bdays} = {r.total_bdays} d
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
