import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { StatusBadge } from "./StatusBadge";
import { useMyProjects } from "../hooks/use-dashboard-summary";
import type { DashboardProjectItem } from "../types";

function barColor(pct: number): string {
  if (pct >= 70) {
    return "bg-emerald-500";
  }
  if (pct >= 40) {
    return "bg-amber-400";
  }
  return "bg-red-500";
}

/** Tarjeta de un proyecto: enlaza a su vista de progreso de solo lectura. */
function ProjectCard({ project }: { project: DashboardProjectItem }) {
  return (
    <Link
      to={`/proyectos/${project.id}/progreso`}
      className="rounded-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
    >
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
              {project.name}
            </h3>
            <StatusBadge variant={project.status} />
          </div>

          {project.client_name && (
            <p className="truncate text-xs text-muted-foreground">{project.client_name}</p>
          )}

          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {project.tasks_completed}/{project.tasks_total} tareas
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {project.progress_pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all duration-300", barColor(project.progress_pct))}
                style={{ width: `${project.progress_pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * "Mis proyectos" (rol User): todos los proyectos donde el usuario es miembro.
 * El backend acota la lista por membresía (/dashboard/me/projects). Cada tarjeta
 * lleva a la vista de progreso de ese proyecto, no a su gestión.
 */
export function MyProjectsPage() {
  const { data, isLoading, isError, refetch } = useMyProjects();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <PageHeader
        title="Mis proyectos"
        description="Proyectos en los que participas."
        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Mis proyectos" }]}
      />

      {isLoading && <LoadingSkeleton rows={4} />}

      {isError && (
        <ErrorState title="No se pudieron cargar tus proyectos" onRetry={() => void refetch()} />
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="Todavía no estás en ningún proyecto"
          hint="Cuando te agreguen a un proyecto aparecerá aquí."
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
