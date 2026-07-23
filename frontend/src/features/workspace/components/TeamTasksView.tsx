import { useMemo, useState } from "react";
import { CornerDownRight, FolderKanban, ListTodo, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { useTeamTasks, useWorkspaceAccess } from "../hooks/use-workspace";
import { nestTasks, type NestedTask } from "../utils/nest-tasks";
import { NewSubtaskModal } from "./NewSubtaskModal";
import type { ApiTeamTask, ProjectTaskStatus } from "../api/workspace.api";

// Etiqueta + color por estado. Reutiliza la máquina de estados de las tareas del
// proyecto (una sola fuente de verdad conceptual): entregar = "en revisión".
const STATUS_META: Record<ProjectTaskStatus, { label: string; badge: string }> = {
  pendiente_por_iniciar: {
    label: "Por iniciar",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  en_progreso: {
    label: "En progreso",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  en_revision: {
    label: "En revisión",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  devuelta: {
    label: "Devuelta",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
  completada: {
    label: "Completada",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  cancelada: {
    label: "Cancelada",
    badge: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
  },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface ModuleGroup {
  workItemId: string;
  workItemName: string;
  projectName: string;
  roots: NestedTask[];
  totalCount: number;
  doneCount: number;
}

/**
 * Agrupa por módulo y anida subtareas bajo su padre. El conteo `done/total`
 * sube "todo lo que hay" (raíces + hijos) para reflejar el trabajo real.
 */
function groupByModule(tasks: ApiTeamTask[]): ModuleGroup[] {
  const byModule = new Map<string, ApiTeamTask[]>();
  for (const t of tasks) {
    const arr = byModule.get(t.work_item_id) ?? [];
    arr.push(t);
    byModule.set(t.work_item_id, arr);
  }
  return [...byModule.entries()].map(([workItemId, items]) => ({
    workItemId,
    workItemName: items[0].work_item_name,
    projectName: items[0].project_name,
    roots: nestTasks(items),
    totalCount: items.length,
    doneCount: items.filter((t) => t.status === "completada").length,
  }));
}

function TaskRow({
  task,
  isSubtask = false,
  canReview,
  onAddSubtask,
}: {
  task: ApiTeamTask;
  isSubtask?: boolean;
  canReview: boolean;
  onAddSubtask?: (task: ApiTeamTask) => void;
}) {
  const meta = STATUS_META[task.status];
  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0 dark:border-slate-800",
        // Ligera indentación + separador cuando es subtarea, para que se lea el árbol.
        isSubtask && "pl-10",
      )}
    >
      {isSubtask ? (
        <CornerDownRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
      ) : (
        <ListTodo className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-700 dark:text-slate-200">{task.title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {task.assignee_name ?? "Sin responsable"} · vence {formatDate(task.due_date)}
        </p>
      </div>
      <span
        className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.badge)}
      >
        {meta.label}
      </span>
      {/* Botón sólo en tareas raíz y para el líder (delegar en integrantes). */}
      {!isSubtask && canReview && onAddSubtask && (
        <button
          type="button"
          onClick={() => {
            onAddSubtask(task);
          }}
          title="Agregar subtarea"
          aria-label={`Agregar subtarea a ${task.title}`}
          className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-all hover:bg-brand-teal/10 hover:text-brand-teal-dark focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-brand-teal"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Repositorio del equipo: tareas reales delegadas, agrupadas por módulo, con
 * subtareas anidadas bajo su padre. Jefes y líder ven el avance de un vistazo;
 * el líder puede partir cada tarea general en subtareas para sus integrantes
 * (Fase 3), lo que también aparece en la trazabilidad del proyecto.
 */
export function TeamTasksView({ teamId }: { teamId: string }) {
  const query = useTeamTasks(teamId);
  const accessQuery = useWorkspaceAccess(teamId);
  const canReview = accessQuery.data?.can_review ?? false;
  const [subtaskParent, setSubtaskParent] = useState<ApiTeamTask | null>(null);
  const groups = useMemo(() => groupByModule(query.data ?? []), [query.data]);

  if (query.isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudieron cargar las tareas del equipo"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={FolderKanban}
          title="Este equipo aún no tiene tareas delegadas"
          hint="Cuando se le asigne una tarea al equipo, aparecerá aquí agrupada por módulo."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {groups.map((group) => (
        <section
          key={group.workItemId}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <header className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
            <div className="flex min-w-0 items-center gap-2">
              <FolderKanban className="size-4 shrink-0 text-brand-teal" />
              <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {group.workItemName}
              </p>
              <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                · {group.projectName}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {group.doneCount}/{group.totalCount}
            </span>
          </header>
          <div>
            {group.roots.map((node) => (
              <div key={node.task.id}>
                <TaskRow task={node.task} canReview={canReview} onAddSubtask={setSubtaskParent} />
                {node.children.map((child) => (
                  <TaskRow key={child.id} task={child} isSubtask canReview={canReview} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}

      {subtaskParent && (
        <NewSubtaskModal
          teamId={teamId}
          parent={subtaskParent}
          onClose={() => {
            setSubtaskParent(null);
          }}
        />
      )}
    </div>
  );
}
