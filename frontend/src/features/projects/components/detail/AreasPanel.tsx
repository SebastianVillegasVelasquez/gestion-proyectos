import { useMemo } from "react";
import { Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { positionLabel } from "../../types/labels";
import { useProjectAreas } from "../../hooks/use-areas";
import { areaTone } from "../../utils/area-progress";
import type { AreaProgress } from "../../types/api.types";

function AreaCard({ area }: { area: AreaProgress }) {
  const tone = areaTone(area.completion_pct);
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
            {positionLabel(area.position)}
          </span>
          <span className={cn("shrink-0 text-sm font-bold", tone.text)}>
            {area.completion_pct}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn("h-full rounded-full transition-all", tone.bar)}
            style={{ width: `${area.completion_pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {area.member_count} {area.member_count === 1 ? "persona" : "personas"}
          </span>
          <span>
            {area.completed_tasks}/{area.assigned_tasks} tareas
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AreasPanel({ projectId }: { projectId: string }) {
  const query = useProjectAreas(projectId);
  const areas = useMemo(() => query.data?.areas ?? [], [query.data]);

  if (query.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }
  if (query.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el avance por equipo"
        hint="Hubo un problema al obtener el progreso de las áreas."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const totalAssigned = query.data?.total_assigned ?? 0;
  const totalCompleted = query.data?.total_completed ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Layers className="size-4 text-blue-500" /> Progreso por equipo
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {areas.length}
          </span>
        </h2>
        {totalAssigned > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {totalCompleted}/{totalAssigned} tareas completadas en total
          </span>
        )}
      </div>

      <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
        Avance de cada equipo (por cargo) según las tareas que tiene a su cargo en este proyecto.
      </p>

      {areas.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Aún no hay tareas asignadas"
          hint="Cuando se asignen tareas a integrantes, verás aquí el avance de cada equipo."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {areas.map((area) => (
            <AreaCard key={area.position} area={area} />
          ))}
        </div>
      )}
    </div>
  );
}
