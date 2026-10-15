import { cn } from "@/lib/utils";
import type { TeamPerformance } from "../../api/analytics.api";
import { bdays } from "../../utils/format";

export function TeamsTab({ rows }: { rows: TeamPerformance[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ningún equipo con tareas en este filtro.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Equipo</th>
            <th className="px-3 py-3 text-right">Asignadas</th>
            <th className="px-3 py-3 text-right">Completadas</th>
            <th className="px-3 py-3 text-right">Abiertas</th>
            <th className="px-3 py-3 text-right">Vencidas</th>
            <th className="px-3 py-3 text-right">Cycle</th>
            <th className="px-3 py-3 text-right">Revisión</th>
            <th className="px-3 py-3 text-right">Retrabajo</th>
            <th className="px-4 py-3">Carga por integrante</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.team_id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium text-foreground">{t.team_name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{t.assigned}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{t.completed}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{t.open}</td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  t.overdue > 0 && "font-semibold text-brand-red-dark dark:text-brand-red",
                )}
              >
                {t.overdue}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {bdays(t.cycle_time_bdays)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {bdays(t.review_time_bdays)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {t.rework_rate_pct}%
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {t.open_per_member.length === 0
                  ? "—"
                  : t.open_per_member.map((m) => `${m.name} (${String(m.open_count)})`).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
