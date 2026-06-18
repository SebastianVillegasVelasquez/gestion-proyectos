import { useState } from "react";
import { useNavigate } from "react-router";
import { Moon, Sun, Calendar, FolderTree, Users, UsersRound, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import type { Project } from "../types/api.types";
import { ProjectActions } from "./detail/ProjectActions";
import { StructurePanel } from "./detail/StructurePanel";
import { MembersPanel } from "./detail/MembersPanel";
import { WorkTeamsPanel } from "./detail/WorkTeamsPanel";
import { TraceabilityPanel } from "./detail/TraceabilityPanel";

type Tab = "estructura" | "integrantes" | "equipos" | "trazabilidad";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function ProjectDetailView({
  project,
  dark,
  onToggleDark,
}: {
  project: Project;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("estructura");
  const progress = Math.round(project.progress_pct ?? 0);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 sm:p-5">
      {/* Encabezado */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate("/projects")}
            className="mb-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← Proyectos
          </button>
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            {project.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="size-3.5" />
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
            {project.client_name && (
              <span className="ml-2 text-slate-400">· {project.client_name}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      {/* Accesos: Cronograma + Tareas */}
      <ProjectActions projectId={project.id} />

      {/* Progreso */}
      <Card className="shrink-0">
        <CardContent className="pt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Progreso general</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Estructura | Integrantes | Equipos de trabajo */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            { id: "estructura", label: "Estructura", icon: FolderTree },
            { id: "integrantes", label: "Integrantes", icon: Users },
            { id: "equipos", label: "Equipos de trabajo", icon: UsersRound },
            { id: "trazabilidad", label: "Trazabilidad", icon: History },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "estructura" && <StructurePanel projectId={project.id} />}
        {tab === "integrantes" && <MembersPanel projectId={project.id} />}
        {tab === "equipos" && (
          <ErrorBoundary
            fallbackTitle="No se pudo mostrar el apartado de equipos"
            fallbackHint="Ocurrió un error al renderizar los equipos de trabajo. Intenta recargar."
          >
            <WorkTeamsPanel />
          </ErrorBoundary>
        )}
        {tab === "trazabilidad" && <TraceabilityPanel projectId={project.id} />}
      </div>
    </div>
  );
}
