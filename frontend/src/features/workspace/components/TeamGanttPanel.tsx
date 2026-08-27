import { useOutletContext } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { LoadingSkeleton } from "@/components/common/AsyncStates";
import { useProject } from "@/features/projects/hooks/use-projects";
import { GanttView } from "@/features/projects/gantt/components/GanttView";

/**
 * Cronograma del equipo: el MISMO componente que el cronograma del proyecto,
 * en modo incrustado y recortado a este equipo.
 *
 * Reutilizarlo —en vez de dibujar una línea de tiempo propia— es lo que hace
 * que el equipo vea su trabajo colgado de la estructura real del proyecto, con
 * las mismas barras, dependencias, zoom y edición por arrastre. Una segunda
 * implementación acabaría discrepando de la primera en cuanto una de las dos
 * cambiara.
 *
 * Un equipo vive dentro de un proyecto, así que `projectId` siempre existe y
 * todas las tareas del equipo pertenecen a ese proyecto.
 */
export function TeamGanttPanel({ projectId, teamId }: { projectId: string; teamId: string }) {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { data: project, isLoading, isError } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <AlertTriangle className="size-6 text-amber-500" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          No se pudo cargar el cronograma
        </p>
        <p className="max-w-xs text-[12px] text-slate-400 dark:text-slate-500">
          El proyecto de este equipo no está disponible ahora mismo.
        </p>
      </div>
    );
  }

  return <GanttView project={project} dark={dark} onToggleDark={toggleDark} embed={{ teamId }} />;
}
