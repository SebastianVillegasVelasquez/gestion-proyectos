import { cn } from "@/lib/utils";
import type { PersonPerformance } from "../../api/analytics.api";
import { bdays } from "../../utils/format";

export function IndividualTab({ rows }: { rows: PersonPerformance[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nadie con tareas en este filtro.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Persona</th>
            <th className="px-3 py-3 text-right">Completadas</th>
            <th className="px-3 py-3 text-right">Abiertas</th>
            <th className="px-3 py-3 text-right">Cycle</th>
            <th className="px-3 py-3 text-right">A tiempo</th>
            <th className="px-3 py-3 text-right">Devoluciones</th>
            <th className="px-3 py-3 text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.user_id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{p.completed}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{p.open_count}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {bdays(p.cycle_time_bdays)}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  p.on_time_pct < 70 && "text-amber-600 dark:text-amber-400",
                )}
              >
                {p.on_time_pct}%
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  p.returns_received > 0 && "text-brand-red-dark dark:text-brand-red",
                )}
              >
                {p.returns_received}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {p.logged_days.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
