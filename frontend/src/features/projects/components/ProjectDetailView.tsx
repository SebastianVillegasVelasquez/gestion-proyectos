import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  ChevronLeft,
  FolderTree,
  History,
  Layers,
  Moon,
  Sun,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import type { Project } from "../types/api.types";
import { ProjectActions } from "./detail/ProjectActions";
import { ClientAccessCard } from "./detail/ClientAccessCard";
import { StructurePanel } from "./detail/StructurePanel";
import { MembersPanel } from "./detail/MembersPanel";
import { WorkTeamsPanel } from "./detail/WorkTeamsPanel";
import { TraceabilityPanel } from "./detail/TraceabilityPanel";
import { AreasPanel } from "./detail/AreasPanel";

type Tab = "estructura" | "integrantes" | "equipos" | "areas" | "trazabilidad";

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
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-hidden p-4 sm:p-6 lg:px-12">
      {/* Encabezado */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate("/projects")}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Proyectos
          </button>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {project.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
            <Calendar className="size-4" />
            <span>
              {formatDate(project.start_date)} → {formatDate(project.end_date)}
            </span>
            {project.client_name && (
              <>
                <span className="text-border">·</span>
                <span>{project.client_name}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      {/* Accesos: Cronograma + Tareas */}
      <ProjectActions projectId={project.id} />

      {/* Progreso */}
      <Card className="shrink-0 rounded-2xl">
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-foreground">Progreso general</span>
            <span className="text-xl font-semibold tabular-nums text-brand-blue-dark dark:text-brand-blue">
              {progress}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-brand-blue transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compartir el avance con el cliente (enlace público de solo lectura) */}
      <ClientAccessCard projectId={project.id} />

      {/* Tabs: Estructura | Integrantes | Equipos | Progreso por equipo | Trazabilidad */}
      <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-1 border-b border-border px-1">
        {(
          [
            { id: "estructura", label: "Estructura", icon: FolderTree },
            { id: "integrantes", label: "Integrantes", icon: Users },
            { id: "equipos", label: "Equipos de trabajo", icon: UsersRound },
            { id: "areas", label: "Progreso por equipo", icon: Layers },
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
              "-mb-px flex items-center gap-2 border-b-[2.5px] py-3 text-[15px] transition-colors",
              tab === id
                ? "border-brand-blue font-semibold text-brand-blue-dark dark:text-brand-blue"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        {tab === "areas" && <AreasPanel projectId={project.id} />}
        {tab === "trazabilidad" && <TraceabilityPanel projectId={project.id} />}
      </div>
    </div>
  );
}
