import { cn } from "@/lib/utils";
import type { ProjectAnalytics } from "../../api/analytics.api";
import { path, statusLabel } from "../../utils/format";

export function TasksTab({ rows }: { rows: ProjectAnalytics["tasks"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Ubicación</th>
            <th className="px-3 py-3">Tarea</th>
            <th className="px-3 py-3">Responsable</th>
            <th className="px-3 py-3">Equipo</th>
            <th className="px-3 py-3 text-center">Estado</th>
            <th className="px-3 py-3">Avance</th>
            <th className="px-3 py-3 text-center">Fin plan.</th>
            <th className="px-3 py-3 text-center">Fin real</th>
            <th className="px-3 py-3 text-right">Retraso</th>
            <th className="px-3 py-3 text-right">Dev.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.task_id} className="border-b border-border last:border-0">
              <td className="max-w-[16rem] px-4 py-2.5 text-xs text-muted-foreground">
                <span className="block truncate" title={path(t.element_path)}>
                  {path(t.element_path)}
                </span>
              </td>
              <td className="px-3 py-2.5 text-foreground">{t.title}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{t.responsable ?? "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{t.equipo ?? "—"}</td>
              <td className="px-3 py-2.5 text-center text-muted-foreground">
                {statusLabel(t.estado)}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-blue"
                      style={{ width: `${String(t.progress_pct)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                    {t.progress_pct}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                {t.due_date ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                {t.completed_date ?? "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  t.slip_bdays != null && t.slip_bdays > 0
                    ? "font-semibold text-brand-red-dark dark:text-brand-red"
                    : "text-muted-foreground",
                )}
              >
                {t.slip_bdays == null
                  ? "—"
                  : `${t.slip_bdays > 0 ? "+" : ""}${String(t.slip_bdays)} d`}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  t.returns > 0 && "text-brand-red-dark dark:text-brand-red",
                )}
              >
                {t.returns}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                Sin tareas para este filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
