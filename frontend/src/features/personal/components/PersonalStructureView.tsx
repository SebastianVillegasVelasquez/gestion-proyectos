import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { useNodeTypes, useWorkTree } from "@/features/projects/hooks/use-structure";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import { formatDateRange, taskRisk } from "@/features/projects/utils/task-dates";
import type { WorkItemTree } from "@/features/projects/types/api.types";
import { STATUS_META } from "@/features/workspace/utils/team-tasks";
import type { ApiMyTask } from "../api/personal.api";
import { MyTaskDeliverAction } from "./my-task-bits";
import { dueStatus } from "../utils/due-status";

interface TipoMeta {
  nombre: string;
  esDep: boolean;
}

interface LeafCbs {
  today: string;
  deliverableTaskIds: Set<string>;
  onOpenIndividual: (task: ApiMyTask) => void;
}

// ── Fila de tarea (hoja) — misma lectura que la Estructura de Equipos, pero de
//    SOLO LECTURA: sin reasignar ni editar fechas. ────────────────────────────
function TaskLeaf({ task, cbs }: { task: ApiMyTask; cbs: LeafCbs }) {
  const risk = taskRisk(task, cbs.today);
  const meta = STATUS_META[task.status];
  const isDone = dueStatus(task, cbs.today) === "done";

  return (
    <div className="relative before:absolute before:left-[-16px] before:top-[20px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']">
      <div className="group flex flex-wrap items-center gap-2.5 rounded-lg py-2 pl-2 pr-3 transition-colors hover:bg-accent/40">
        <span className="size-5 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-full bg-brand-gold" />
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
            <ClipboardList className="size-2.5" /> tarea
          </span>
          <span className="truncate text-[14px] font-medium text-foreground/85">{task.title}</span>
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span
            className={cn(
              "hidden items-center gap-1 text-[11px] tabular-nums sm:flex",
              risk === "vencida"
                ? "font-semibold text-rose-600 dark:text-rose-400"
                : "text-muted-foreground",
            )}
          >
            {risk === "vencida" && <AlertTriangle className="size-3" />}
            {formatDateRange(task.start_date, task.due_date)}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", meta.badge)}>
            {meta.label}
          </span>
          <MyTaskDeliverAction
            task={task}
            isDone={isDone}
            hasDeliverable={cbs.deliverableTaskIds.has(task.id)}
            onOpenIndividual={cbs.onOpenIndividual}
          />
        </span>
      </div>
    </div>
  );
}

// ── Nodo del árbol ─────────────────────────────────────────────────────────
interface NodeCbs extends LeafCbs {
  typeMetaById: Map<string, TipoMeta>;
  tasksByItem: Map<string, ApiMyTask[]>;
  countInSubtree: Map<string, number>;
}

function Node({ node, depth, cb }: { node: WorkItemTree; depth: number; cb: NodeCbs }) {
  const [open, setOpen] = useState(true);
  const total = cb.countInSubtree.get(node.id) ?? 0;
  if (total === 0) {
    return null;
  }

  const tm = cb.typeMetaById.get(node.tipo_id);
  const style = tipoStyle(node.tipo_id, tm?.nombre, tm?.esDep);
  const own = cb.tasksByItem.get(node.id) ?? [];
  const nameSize =
    depth === 0
      ? "text-[15.5px] font-semibold text-foreground"
      : depth === 1
        ? "text-[15px] font-medium text-foreground/90"
        : "text-[14.5px] font-medium text-foreground/80";

  return (
    <div
      className={cn(
        "relative",
        depth > 0 &&
          "before:absolute before:left-[-16px] before:top-[22px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']",
      )}
    >
      <div className="group flex items-center gap-2.5 py-2.5 pl-2 pr-3">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {!open && (
          <span
            className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground"
            title={`${String(total)} tareas mías dentro`}
          >
            {total}
          </span>
        )}

        <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
            style.chip,
          )}
        >
          {tm?.nombre ?? "elemento"}
        </span>
        <span className={cn("truncate", nameSize)}>{node.nombre}</span>
      </div>

      {open && (
        <div className="ml-[31px] border-l-[1.5px] border-border pl-4">
          {own.map((task) => (
            <TaskLeaf key={task.id} task={task} cbs={cb} />
          ))}
          {node.children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} cb={cb} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Un proyecto ────────────────────────────────────────────────────────────
function ProjectStructureBlock({
  projectId,
  projectName,
  tasks,
  cbs,
}: {
  projectId: string;
  projectName: string;
  tasks: ApiMyTask[];
  cbs: LeafCbs;
}) {
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);

  const typeMetaById = useMemo(() => {
    const m = new Map<string, TipoMeta>();
    (typesQuery.data ?? []).forEach((t) => {
      m.set(t.id, { nombre: t.nombre, esDep: t.es_dependencia_externa });
    });
    return m;
  }, [typesQuery.data]);

  const tasksByItem = useMemo(() => {
    const m = new Map<string, ApiMyTask[]>();
    for (const t of tasks) {
      if (!t.work_item_id) {
        continue;
      }
      const list = m.get(t.work_item_id);
      if (list) {
        list.push(t);
      } else {
        m.set(t.work_item_id, [t]);
      }
    }
    return m;
  }, [tasks]);

  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  const countInSubtree = useMemo(() => {
    const count = new Map<string, number>();
    const walk = (nodes: WorkItemTree[]): number => {
      let sum = 0;
      for (const node of nodes) {
        const here = (tasksByItem.get(node.id)?.length ?? 0) + walk(node.children);
        count.set(node.id, here);
        sum += here;
      }
      return sum;
    };
    walk(tree);
    return count;
  }, [tree, tasksByItem]);

  const loose = tasks.filter((t) => !t.work_item_id);
  const cb: NodeCbs = { ...cbs, typeMetaById, tasksByItem, countInSubtree };

  return (
    <section className="rounded-2xl border border-border">
      <h3 className="border-b border-border bg-accent/50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {projectName}
      </h3>
      <div className="p-3">
        {treeQuery.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <>
            {tree.map((node) => (
              <Node key={node.id} node={node} depth={0} cb={cb} />
            ))}
            {loose.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fuera de la estructura
                </p>
                {loose.map((task) => (
                  <TaskLeaf key={task.id} task={task} cbs={cbs} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * «Mis tareas» sobre la ESTRUCTURA del proyecto: mismo árbol, colores y lectura
 * que la vista de Equipos, pero de solo lectura (un usuario con tareas
 * individuales no reasigna ni cambia fechas). Un bloque por proyecto, con solo
 * las ramas donde el usuario tiene tareas. El filtrado (individual / en equipo,
 * estado, elemento) lo hace `MyTasksView` y baja ya aplicado en `tasks`.
 */
export function PersonalStructureView({
  tasks,
  today,
  deliverableTaskIds,
  onOpenIndividual,
}: {
  tasks: ApiMyTask[];
  today: string;
  deliverableTaskIds: Set<string>;
  onOpenIndividual: (task: ApiMyTask) => void;
}) {
  const byProject = useMemo(() => {
    const groups = new Map<string, { name: string; tasks: ApiMyTask[] }>();
    for (const t of tasks) {
      const g = groups.get(t.project_id) ?? { name: t.project_name, tasks: [] };
      g.tasks.push(t);
      groups.set(t.project_id, g);
    }
    return [...groups.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const cbs: LeafCbs = { today, deliverableTaskIds, onOpenIndividual };

  if (byProject.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border">
        <EmptyState
          icon={ClipboardList}
          title="Nada que coincida con el filtro"
          hint="Ajusta los filtros para ver tus tareas sobre la estructura del proyecto."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {byProject.map((p) => (
        <ProjectStructureBlock
          key={p.id}
          projectId={p.id}
          projectName={p.name}
          tasks={p.tasks}
          cbs={cbs}
        />
      ))}
    </div>
  );
}
