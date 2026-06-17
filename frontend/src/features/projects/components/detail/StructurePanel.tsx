import { useMemo } from "react";
import { Layers, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { usePhases } from "../../hooks/use-phases";
import { useNodes } from "../../hooks/use-nodes";
import { buildNodeTree, flattenTree } from "../../utils/node-tree";
import { nodeDisplayType } from "../../types/labels";
import type { Phase } from "../../types/api.types";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function PhaseChip({ phase }: { phase: Phase }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {phase.order_index + 1}
        </span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{phase.name}</span>
      </div>
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        {phase.duration_days != null
          ? `${phase.duration_days} días`
          : `${formatDate(phase.start_date)} → ${formatDate(phase.end_date)}`}
      </span>
    </div>
  );
}

export function StructurePanel({ projectId }: { projectId: string }) {
  const phasesQuery = usePhases(projectId);
  const nodesQuery = useNodes(projectId);

  const flatNodes = useMemo(
    () => flattenTree(buildNodeTree(nodesQuery.data ?? [])),
    [nodesQuery.data],
  );

  const phasesById = useMemo(() => {
    const map = new Map<string, Phase>();
    (phasesQuery.data ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [phasesQuery.data]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Layers className="size-4 text-amber-500" /> Fases
        </h2>
        {phasesQuery.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : (phasesQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">
            Sin fases definidas todavía.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {phasesQuery.data?.map((phase) => (
              <PhaseChip key={phase.id} phase={phase} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <FolderTree className="size-4 text-slate-400" /> Estructura de contenidos
        </h2>
        {nodesQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : flatNodes.length === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-slate-500">
            Sin contenidos definidos todavía.
          </p>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-0.5 py-3">
              {flatNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
                >
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {nodeDisplayType(node)}
                  </span>
                  <span className="truncate text-slate-700 dark:text-slate-200">{node.name}</span>
                  {node.phase_id && phasesById.has(node.phase_id) && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                        "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
                      )}
                    >
                      {phasesById.get(node.phase_id)!.name}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
