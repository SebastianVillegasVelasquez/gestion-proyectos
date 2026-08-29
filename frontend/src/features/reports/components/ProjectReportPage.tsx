import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BarChart3, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/utils/get-error-message";
import { TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import type { TaskStatus } from "@/features/projects/types/api.types";
import {
  analyticsApi,
  type AnalyticsFilters as Filters,
  type DeliveryLapse,
  type PersonPerformance,
  type ProjectAnalytics,
  type TeamPerformance,
} from "../api/analytics.api";
import { useProjectAnalytics } from "../hooks/use-analytics";
import { filenameFromDisposition, saveBlob } from "../utils/download";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { BurnupChart } from "./viz/BurnupChart";
import { ThroughputChart } from "./viz/ThroughputChart";
import "./viz/viz.css";

const TABS = [
  { id: "general", label: "General" },
  { id: "equipos", label: "Equipos" },
  { id: "individual", label: "Individual" },
  { id: "lapsos", label: "Lapsos de entrega" },
  { id: "tareas", label: "Tareas" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const statusLabel = (s: string) => TASK_STATUS_LABELS[s as TaskStatus] ?? s;
const bdays = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`;
const path = (p: string[]) => (p.length ? p.join(" › ") : "Sin ubicar");

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "bad" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums text-foreground",
          tone === "bad" && "text-brand-red-dark dark:text-brand-red",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GeneralTab({ data }: { data: ProjectAnalytics }) {
  const ov = data.overview;
  const doneThisPeriod = ov.throughput_last_weeks.reduce((s, w) => s + w.count, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Avance" value={`${ov.progress_pct}%`} hint={`${ov.total_tasks} tareas`} />
        <Tile
          label="Vencidas abiertas"
          value={ov.overdue_open}
          tone={ov.overdue_open > 0 ? "bad" : undefined}
        />
        <Tile
          label="En riesgo (≤1 sem.)"
          value={ov.at_risk_open}
          tone={ov.at_risk_open > 0 ? "warn" : undefined}
        />
        <Tile
          label="Desviación media"
          value={bdays(ov.avg_schedule_slip_bdays)}
          hint="+ = cierra tarde"
          tone={ov.avg_schedule_slip_bdays > 0 ? "warn" : undefined}
        />
        <Tile
          label="Cycle time (mediana)"
          value={bdays(ov.cycle_time_p50_bdays)}
          hint="inicio → cierre"
        />
        <Tile label="Cycle time (p90)" value={bdays(ov.cycle_time_p90_bdays)} />
        <Tile
          label="Retrabajo"
          value={`${ov.rework_rate_pct}%`}
          hint="tareas devueltas alguna vez"
          tone={ov.rework_rate_pct >= 20 ? "warn" : undefined}
        />
        <Tile label="Completadas (8 sem.)" value={doneThisPeriod} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Avance en el tiempo</h3>
            <BurnupChart points={data.burnup.points} scope={data.burnup.total_scope} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Tareas completadas por semana
            </h3>
            <ThroughputChart weeks={ov.throughput_last_weeks} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Tareas por estado</h3>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {Object.entries(ov.by_status).map(([s, count]) => (
              <li key={s} className="flex items-center justify-between gap-2">
                <span className="truncate text-muted-foreground">{statusLabel(s)}</span>
                <span className="tabular-nums text-foreground">{count}</span>
              </li>
            ))}
            {Object.keys(ov.by_status).length === 0 && (
              <li className="text-xs text-muted-foreground">Sin tareas.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamsTab({ rows }: { rows: TeamPerformance[] }) {
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

function IndividualTab({ rows }: { rows: PersonPerformance[] }) {
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
            <th className="px-3 py-3 text-right">Horas</th>
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
                {p.logged_hours.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LapsesTab({ rows }: { rows: DeliveryLapse[] }) {
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

function TasksTab({ rows }: { rows: ProjectAnalytics["tasks"] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Ubicación</th>
            <th className="px-3 py-3">Tarea</th>
            <th className="px-3 py-3">Responsable</th>
            <th className="px-3 py-3">Equipo</th>
            <th className="px-3 py-3 text-center">Estado</th>
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
              <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                Sin tareas para este filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectReportPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  const [tab, setTab] = useState<TabId>("general");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const query = useProjectAnalytics(projectId, filters);
  const data = query.data;

  const handleDownload = () => {
    setDownloading(true);
    setDownloadError(null);
    analyticsApi
      .downloadHtml(projectId, filters)
      .then(({ blob, disposition }) => {
        saveBlob(blob, filenameFromDisposition(disposition, "informe.html"));
      })
      .catch((err: unknown) => {
        setDownloadError(getErrorMessage(err, "No se pudo descargar el informe"));
      })
      .finally(() => {
        setDownloading(false);
      });
  };

  const generatedAt = useMemo(
    () => (data ? new Date(data.generated_at).toLocaleString("es-CO") : ""),
    [data],
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 overflow-y-auto p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="mb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {data?.project_name ?? "Proyecto"}
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <BarChart3 className="size-5 text-brand-teal" /> Analíticas
          </h1>
          {generatedAt && (
            <p className="text-[11px] text-muted-foreground">Generado {generatedAt}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !data}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
        >
          <Download className="size-4" />
          {downloading ? "Preparando…" : "Descargar HTML"}
        </button>
      </header>

      {downloadError && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {downloadError}
        </p>
      )}

      <AnalyticsFilters projectId={projectId} value={filters} onChange={setFilters} />

      {/* Resumen por IA (fase 6.2): el bloque ya vive aquí; el texto llega al
          conectar el módulo conversacional de OpenAI. */}
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-gold" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Resumen por IA</h2>
            <p className="text-[13px] text-muted-foreground">
              El resumen automático del informe se genera al conectar el módulo de IA (Fase 6.2).
              Mientras tanto, revisa las secciones de abajo.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
            }}
            className={cn(
              "rounded-t-md px-3 py-2 text-[13px] font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-accent" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          No se pudo cargar el informe.
        </p>
      ) : data ? (
        <div className={cn(query.isFetching && "opacity-60 transition-opacity")}>
          {tab === "general" && <GeneralTab data={data} />}
          {tab === "equipos" && <TeamsTab rows={data.by_team} />}
          {tab === "individual" && <IndividualTab rows={data.by_person} />}
          {tab === "lapsos" && <LapsesTab rows={data.delivery_lapses} />}
          {tab === "tareas" && <TasksTab rows={data.tasks} />}
        </div>
      ) : null}
    </div>
  );
}

export default ProjectReportPage;
