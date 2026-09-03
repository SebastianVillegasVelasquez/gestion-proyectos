import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { CalendarRange } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { EmptyState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { GanttView } from "@/features/projects/gantt/components/GanttView";
import { useProject } from "@/features/projects/hooks/use-projects";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { ApiMyTask } from "../api/personal.api";

/**
 * Cronograma de UN proyecto recortado a la persona. Es el mismo componente que
 * el cronograma del proyecto y el del equipo —barras, dependencias, zoom,
 * arrastre—, en modo incrustado: una segunda línea de tiempo propia acabaría
 * discrepando de la de al lado en cuanto una de las dos cambiara.
 */
function ProjectGanttBlock({ projectId, assigneeId }: { projectId: string; assigneeId: string }) {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading || !project) {
    return (
      <div className="rounded-2xl border border-border p-4">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    // Altura DEFINIDA, no automática: el cronograma incrustado se dibuja con
    // `h-full` y su barra de desplazamiento horizontal vive al pie del bloque.
    // Sin una altura que respetar, el bloque crecía sin límite, el `overflow`
    // del padre recortaba el pie y la barra quedaba fuera de la pantalla: el
    // cronograma se veía, pero no se podía mover en el tiempo.
    <section className="flex h-[72vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border">
      <h3 className="shrink-0 border-b border-border bg-accent/50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {project.name}
      </h3>
      <div className="min-h-0 flex-1">
        <GanttView project={project} dark={dark} onToggleDark={toggleDark} embed={{ assigneeId }} />
      </div>
    </section>
  );
}

/**
 * «Mis tareas» sobre el CRONOGRAMA: un bloque por proyecto, cada uno con la
 * línea de tiempo del proyecto recortada a las tareas del usuario, igual que el
 * cronograma individual del espacio de equipo. Los filtros de la cabecera
 * («Individuales / En equipo», estado, elemento) bajan ya aplicados en `tasks`
 * y aquí solo deciden QUÉ proyectos se pintan; dentro de cada uno manda el
 * recorte por persona, que es el que hace la vista comparable con la del equipo.
 */
export function PersonalGanttView({ tasks }: { tasks: ApiMyTask[] }) {
  const { user } = useAuth();
  const projects = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of tasks) {
      byId.set(t.project_id, t.project_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  if (!user) {
    return null;
  }

  if (projects.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border">
        <EmptyState
          icon={CalendarRange}
          title="Nada que coincida con el filtro"
          hint="Ajusta los filtros para ver tus tareas sobre el cronograma del proyecto."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {projects.map((p) => (
        <ProjectGanttBlock key={p.id} projectId={p.id} assigneeId={user.id} />
      ))}
    </div>
  );
}
