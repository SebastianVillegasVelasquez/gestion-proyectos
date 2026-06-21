import { useParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { StatusBadge } from "./StatusBadge";
import { TaskBoard } from "./TaskBoard";
import { useMyProjectProgress } from "../hooks/use-dashboard-summary";
import { toTask } from "../utils/transform-panels";

function barColor(pct: number): string {
  if (pct >= 70) {
    return "bg-emerald-500";
  }
  if (pct >= 40) {
    return "bg-amber-400";
  }
  return "bg-red-500";
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={cn("text-2xl font-semibold tabular-nums text-foreground", accent)}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/**
 * Vista de SOLO LECTURA del progreso general de un proyecto para el rol User.
 * El acceso lo controla el backend (404 si no es miembro): aquí no hay ninguna
 * acción de edición. Reusa los datos de /dashboard/me/projects/{id}.
 */
export function ProjectProgressPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { data, isLoading, isError, refetch } = useMyProjectProgress(projectId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <PageHeader
        title={data?.name ?? "Progreso del proyecto"}
        description={data?.coordinator ? `Coordinación: ${data.coordinator}` : undefined}
        breadcrumb={[{ label: "Inicio", href: "/" }, { label: data?.name ?? "Proyecto" }]}
      />

      {isLoading && <LoadingSkeleton rows={4} />}

      {isError && (
        <ErrorState
          title="No se pudo cargar el proyecto"
          hint="Puede que no seas miembro de este proyecto o que ya no exista."
          onRetry={() => void refetch()}
        />
      )}

      {data && (
        <>
          {/* Progreso general */}
          <Card accent="gold">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusBadge variant={data.status} />
                  {data.client_name && (
                    <span className="text-sm text-muted-foreground">{data.client_name}</span>
                  )}
                </div>
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {data.progress_pct}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all duration-300", barColor(data.progress_pct))}
                  style={{ width: `${data.progress_pct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatTile label="Tareas" value={data.tasks_total} />
                <StatTile
                  label="Completadas"
                  value={data.tasks_completed}
                  accent="text-emerald-600 dark:text-emerald-400"
                />
                <StatTile
                  label="En revisión"
                  value={data.tasks_in_review}
                  accent="text-brand-teal-dark dark:text-brand-teal"
                />
                <StatTile label="Pendientes" value={data.tasks_pending} />
                <StatTile
                  label="Vencidas"
                  value={data.tasks_overdue}
                  accent="text-brand-red-dark dark:text-brand-red"
                />
              </div>
            </CardContent>
          </Card>

          {/* Mis tareas en este proyecto */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Mis tareas en este proyecto
            </h2>
            {data.my_tasks.length > 0 ? (
              <TaskBoard tasks={data.my_tasks.map(toTask)} />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No tienes tareas asignadas aquí"
                hint="Cuando te asignen tareas en este proyecto aparecerán en este tablero."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
