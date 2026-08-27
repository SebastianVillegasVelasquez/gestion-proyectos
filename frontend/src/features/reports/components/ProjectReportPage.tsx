import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Clock, Download, FileSpreadsheet, ListChecks, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/utils/get-error-message";
import { TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import type { TaskStatus } from "@/features/projects/types/api.types";
import { reportsApi } from "../api/reports.api";
import { useProjectReport } from "../hooks/use-report";
import { filenameFromDisposition, saveBlob } from "../utils/download-csv";

/** "8.00" → "8 h" (sin decimales cuando no hacen falta). */
function hours(value: string | null): string {
  if (value == null) {
    return "—";
  }
  const n = Number(value);
  return Number.isNaN(n) ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} h`;
}

function statusLabel(status: string): string {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status;
}

/**
 * Informe de estado de un proyecto, con exportación a CSV.
 *
 * Lo que hay que enseñar fuera del sistema —a dirección o a un cliente— acaba
 * en una hoja de cálculo, así que la pantalla resume y el botón se lleva el
 * detalle completo.
 */
export function ProjectReportPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const reportQuery = useProjectReport(projectId);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const report = reportQuery.data;

  const handleDownload = () => {
    setDownloading(true);
    setDownloadError(null);
    reportsApi
      .downloadCsv(projectId)
      .then(({ blob, disposition }) => {
        saveBlob(blob, filenameFromDisposition(disposition, "informe.csv"));
      })
      .catch((error: unknown) => {
        setDownloadError(getErrorMessage(error, "No se pudo descargar el informe"));
      })
      .finally(() => {
        setDownloading(false);
      });
  };

  return (
    // `gap-6` y un ancho mayor: el informe es la pantalla que se enseña fuera,
    // y venía tan apretada que las columnas se tocaban.
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-y-auto p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="mb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {report?.project_name ?? "Proyecto"}
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <FileSpreadsheet className="size-5 text-brand-teal" /> Informe
          </h1>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !report}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
        >
          <Download className="size-4" />
          {downloading ? "Preparando…" : "Descargar CSV"}
        </button>
      </header>

      {downloadError && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {downloadError}
        </p>
      )}

      {reportQuery.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-accent" />
      ) : reportQuery.isError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          No se pudo cargar el informe.
        </p>
      ) : report ? (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <ListChecks className="size-5 text-brand-teal" />
                <div>
                  <p className="text-xs text-muted-foreground">Tareas</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {report.total_tareas}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Clock className="size-5 text-brand-teal" />
                <div>
                  <p className="text-xs text-muted-foreground">Dedicado / estimado</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {hours(report.horas_dedicadas)}
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      de {hours(report.horas_estimadas)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Users className="size-5 text-brand-teal" />
                <div>
                  <p className="text-xs text-muted-foreground">Personas con horas</p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {report.horas_por_persona.length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-foreground">Por estado</h2>
                {Object.keys(report.tareas_por_estado).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin tareas todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {Object.entries(report.tareas_por_estado).map(([status, count]) => (
                      <li key={status} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">
                          {statusLabel(status)}
                        </span>
                        <span className="tabular-nums text-foreground">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-foreground">Horas por persona</h2>
                {report.horas_por_persona.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nadie ha registrado horas en este proyecto.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {report.horas_por_persona.map((person) => (
                      <li key={person.nombre} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{person.nombre}</span>
                        <span className="tabular-nums text-foreground">{hours(person.horas)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* `shrink-0`: dentro de un flex-col con scroll, los hijos encogen
              por defecto — y esta tarjeta, al ser la más alta, se comprimía y
              cortaba las filas por la mitad. Quien scrollea es el contenedor. */}
          <Card className="shrink-0">
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-card">
                  <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Elemento</th>
                    <th className="px-4 py-3">Tarea</th>
                    {/* Persona y equipo en columnas separadas: antes se
                        colapsaban en una sola con `responsable ?? equipo`, así
                        que una tarea delegada a un equipo y luego repartida a
                        una persona perdía la mitad de la información. */}
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Fin</th>
                    <th className="px-5 py-3 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.filas.map((row, index) => {
                    const over =
                      row.horas_estimadas != null &&
                      Number(row.horas_dedicadas) > Number(row.horas_estimadas);
                    return (
                      <tr
                        key={`${row.tarea}-${String(index)}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-5 py-2.5">
                          {row.elemento ? (
                            <span className="flex items-center gap-2">
                              {/* Mismo color que en la estructura y el
                                  cronograma: es el mismo objeto en las tres. */}
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  row.elemento_tipo_id
                                    ? tipoStyle(row.elemento_tipo_id).dot
                                    : "bg-muted-foreground/40",
                                )}
                              />
                              <span className="text-muted-foreground">{row.elemento}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">Sin ubicar</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{row.tarea}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {row.responsable ?? <span className="text-muted-foreground/60">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.equipo ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              {row.equipo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">
                          {statusLabel(row.estado)}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
                          {row.fin ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-2.5 text-right tabular-nums",
                            over
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {hours(row.horas_dedicadas)} / {hours(row.horas_estimadas)}
                        </td>
                      </tr>
                    );
                  })}
                  {report.filas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                        Este proyecto todavía no tiene tareas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default ProjectReportPage;
