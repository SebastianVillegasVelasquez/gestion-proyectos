import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BarChart3, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { analyticsApi, type AnalyticsFilters as Filters } from "../api/analytics.api";
import { useProjectAnalytics } from "../hooks/use-analytics";
import { filenameFromDisposition, saveBlob } from "../utils/download";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { ComponentsTab } from "./tabs/ComponentsTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { IndividualTab } from "./tabs/IndividualTab";
import { LapsesTab } from "./tabs/LapsesTab";
import { TasksTab } from "./tabs/TasksTab";
import { TeamsTab } from "./tabs/TeamsTab";
import "./viz/viz.css";

const TABS = [
  { id: "general", label: "General" },
  { id: "componentes", label: "Componentes" },
  { id: "equipos", label: "Equipos" },
  { id: "individual", label: "Individual" },
  { id: "lapsos", label: "Lapsos de entrega" },
  { id: "tareas", label: "Tareas" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 overflow-y-auto p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="mb-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {data?.project_name ?? "Proyecto"}
          </button>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal">
              <BarChart3 className="size-6" />
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Analíticas</h1>
          </div>
          {generatedAt && (
            <p className="mt-2 text-sm text-muted-foreground">Generado {generatedAt}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !data}
          className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-md transition hover:bg-brand-gold-dark disabled:opacity-60"
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

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
            }}
            className={cn(
              "shrink-0 whitespace-nowrap px-4 py-3 text-[15px] font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-brand-gold text-brand-gold-dark dark:text-brand-gold"
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
          {tab === "componentes" && <ComponentsTab rows={data.components} />}
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
