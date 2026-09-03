import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Lock,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import { formatDateRange, taskRisk } from "@/features/projects/utils/task-dates";
import { ReassignTaskButton } from "@/features/projects/components/teams/ReassignTaskButton";
import type { WorkItemTree } from "@/features/projects/types/api.types";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import { STATUS_META } from "../utils/team-tasks";
import { TeamTaskFilterBar } from "./TeamTaskFilterBar";
import {
  EMPTY_TEAM_TASK_FILTERS,
  filterTeamTasks,
  type TeamTaskFilters,
} from "../utils/team-task-filters";

// ── Fila de tarea (hoja del árbol) ──────────────────────────────────────────
// Misma lectura que `StructureTaskRow` de projects/:id/estructura: punto +
// chip «tarea» dorado, responsable en chip teal, pastilla de estado a la
// derecha y rango de fechas tintado por riesgo.

function TaskLeaf({
  task,
  today,
  projectId,
  teamMembers,
  canReview,
  onOpen,
  onDeliver,
  onMarkDelivered,
  onReassigned,
}: {
  task: ApiTeamTask;
  today: string;
  projectId: string;
  teamMembers: ApiTeamMember[];
  canReview: boolean;
  onOpen?: () => void;
  onDeliver?: () => void;
  onMarkDelivered?: () => void;
  onReassigned: () => void;
}) {
  const risk = taskRisk(task, today);
  const meta = STATUS_META[task.status];
  const blockers = task.blocked_by.filter((b) => b.status !== "completada");
  // El líder/supervisor ve UN solo elemento para el responsable: la pastilla
  // teal con su nombre, que ADEMÁS abre el reasignador al pulsarla. Sin permiso
  // de revisión se queda como etiqueta de solo lectura.
  const mergedReassign = canReview && teamMembers.length > 0;
  // El servidor decide si esta tarea se puede entregar todavía y rechaza la
  // entrega con este mismo texto. La vista no vuelve a deducirlo: si hay
  // motivo, enseña "Bloqueada" en vez de un botón que va a fallar.
  const blockedReason = task.delivery_blocked_reason;
  const canDeliverNow = blockedReason === null;

  const titleBlock = (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className="size-2 shrink-0 rounded-full bg-brand-gold" />
      <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
        <ClipboardList className="size-2.5" /> tarea
      </span>
      <span className="truncate text-[14px] font-medium text-foreground/85">{task.title}</span>
      {/* Con permiso de revisión, quién está asignado se muestra —y se cambia—
          desde la pastilla de la derecha; aquí no se repite. */}
      {!mergedReassign &&
        (task.assignee_name ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[11px] font-semibold text-brand-teal-dark dark:text-brand-teal">
            <span className="max-w-[140px] truncate">{task.assignee_name}</span>
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Sin responsable
          </span>
        ))}
    </span>
  );

  return (
    <div
      className={cn(
        "relative",
        "before:absolute before:left-[-16px] before:top-[20px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']",
      )}
    >
      <div className="group flex items-center gap-2.5 rounded-lg py-2 pl-2 pr-3 transition-colors hover:bg-accent/40">
        {/* Hueco del chevron: alinea el título con el de los elementos hermanos. */}
        <span className="size-5 shrink-0" aria-hidden />
        {onOpen ? (
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            {titleBlock}
          </button>
        ) : (
          titleBlock
        )}

        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          {mergedReassign && (
            <ReassignTaskButton
              variant="chip"
              projectId={projectId}
              taskId={task.id}
              currentAssigneeId={task.assignee_id}
              members={teamMembers}
              onDone={onReassigned}
            />
          )}
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
          {(onDeliver !== undefined || onMarkDelivered !== undefined) && blockedReason !== null && (
            <span
              title={blockedReason}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:text-amber-400"
            >
              <Lock className="size-3" />
              Bloqueada
            </span>
          )}
          {onDeliver && canDeliverNow && (
            <button
              type="button"
              onClick={onDeliver}
              title="Entregar con un adjunto (crea un entregable revisable)"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold-dark transition-colors hover:bg-brand-gold/20 dark:text-brand-gold"
            >
              <UploadCloud className="size-3.5" />
              Entregar
            </button>
          )}
          {onMarkDelivered && canDeliverNow && (
            <button
              type="button"
              onClick={onMarkDelivered}
              title="Entregar sin adjunto: crea el entregable y lo manda a revisión (o lo completa si la tarea no exige aprobación)"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              <Check className="size-3.5" />
              Sin adjunto
            </button>
          )}
        </span>
      </div>

      {blockers.length > 0 && (
        <p
          className="ml-[38px] pb-1 text-[11px] text-amber-600 dark:text-amber-500"
          title={`Bloqueada por: ${blockers.map((b) => b.title).join(" · ")}`}
        >
          Bloqueada por: <span className="font-medium">{blockers[0].title}</span>
          {blockers.length > 1 && <span className="font-semibold"> +{blockers.length - 1}</span>}
        </p>
      )}
    </div>
  );
}

// ── Nodo del árbol ─────────────────────────────────────────────────────────

interface NodeCallbacks {
  today: string;
  projectId: string;
  teamMembers: ApiTeamMember[];
  canReview: boolean;
  typeNameById: Map<string, string>;
  tasksByItem: Map<string, ApiTeamTask[]>;
  countInSubtree: Map<string, number>;
  onOpenTask?: (task: ApiTeamTask) => void;
  onDeliverTask?: (task: ApiTeamTask) => void;
  onMarkDeliveredTask?: (task: ApiTeamTask) => void;
  canDeliverTask?: (task: ApiTeamTask) => boolean;
  onReassigned: () => void;
}

function Node({ node, depth, cb }: { node: WorkItemTree; depth: number; cb: NodeCallbacks }) {
  const [open, setOpen] = useState(true);
  const total = cb.countInSubtree.get(node.id) ?? 0;
  if (total === 0) {
    return null;
  }

  const style = tipoStyle(node.tipo_id, cb.typeNameById.get(node.tipo_id));
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
            title={`${String(total)} tareas del equipo dentro`}
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
          {cb.typeNameById.get(node.tipo_id) ?? "elemento"}
        </span>
        <span className={cn("truncate", nameSize)}>{node.nombre}</span>
      </div>

      {open && (
        <div className="ml-[31px] border-l-[1.5px] border-border pl-4">
          {own.map((task) => (
            <TaskLeaf
              key={task.id}
              task={task}
              today={cb.today}
              projectId={cb.projectId}
              teamMembers={cb.teamMembers}
              canReview={cb.canReview}
              onOpen={
                cb.onOpenTask
                  ? () => {
                      cb.onOpenTask?.(task);
                    }
                  : undefined
              }
              onDeliver={
                cb.onDeliverTask && (cb.canDeliverTask?.(task) ?? true)
                  ? () => {
                      cb.onDeliverTask?.(task);
                    }
                  : undefined
              }
              onMarkDelivered={
                cb.onMarkDeliveredTask && (cb.canDeliverTask?.(task) ?? true)
                  ? () => {
                      cb.onMarkDeliveredTask?.(task);
                    }
                  : undefined
              }
              onReassigned={cb.onReassigned}
            />
          ))}
          {node.children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} cb={cb} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vista ──────────────────────────────────────────────────────────────────

interface WorkspaceStructureViewProps {
  tree: WorkItemTree[];
  tasks: ApiTeamTask[];
  typeNameById: Map<string, string>;
  today: string;
  projectId: string;
  teamMembers: ApiTeamMember[];
  canReview: boolean;
  onOpenTask?: (task: ApiTeamTask) => void;
  onDeliverTask?: (task: ApiTeamTask) => void;
  onMarkDeliveredTask?: (task: ApiTeamTask) => void;
  canDeliverTask?: (task: ApiTeamTask) => boolean;
  onReassigned: () => void;
}

/**
 * La estructura del proyecto vista desde el equipo, con los MISMOS estilos que
 * `projects/:id/estructura`: chips de tipo con color, árbol con conectores y
 * filas de tarea con responsable y estado. Solo pinta las ramas que tienen
 * trabajo de este equipo.
 */
export function WorkspaceStructureView({
  tree,
  tasks,
  typeNameById,
  today,
  projectId,
  teamMembers,
  canReview,
  onOpenTask,
  onDeliverTask,
  onMarkDeliveredTask,
  canDeliverTask,
  onReassigned,
}: WorkspaceStructureViewProps) {
  // Mismos filtros que la vista Lista (texto, estado, responsable, bloqueadas):
  // se aplican ANTES de armar el árbol, así el líder puede aislar "lo de Ana"
  // o "lo que está en revisión" sin salir de la estructura.
  const [filters, setFilters] = useState<TeamTaskFilters>(EMPTY_TEAM_TASK_FILTERS);
  const visibleTasks = useMemo(() => filterTeamTasks(tasks, filters), [tasks, filters]);

  const tasksByItem = useMemo(() => {
    const map = new Map<string, ApiTeamTask[]>();
    for (const task of visibleTasks) {
      if (!task.work_item_id) {
        continue;
      }
      const list = map.get(task.work_item_id);
      if (list) {
        list.push(task);
      } else {
        map.set(task.work_item_id, [task]);
      }
    }
    return map;
  }, [visibleTasks]);

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

  const looseTasks = visibleTasks.filter((t) => !t.work_item_id);
  const placed = visibleTasks.length - looseTasks.length;

  const cb: NodeCallbacks = {
    today,
    projectId,
    teamMembers,
    canReview,
    typeNameById,
    tasksByItem,
    countInSubtree,
    onOpenTask,
    onDeliverTask,
    onMarkDeliveredTask,
    canDeliverTask,
    onReassigned,
  };

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        Este equipo aún no tiene tareas en la estructura.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Filtros: mismos que la vista Lista, para el líder/supervisor. */}
      {canReview && (
        <div className="mb-2 overflow-hidden rounded-lg border border-border">
          <TeamTaskFilterBar
            filters={filters}
            onChange={(patch) => {
              setFilters((f) => ({ ...f, ...patch }));
            }}
            onReset={() => {
              setFilters(EMPTY_TEAM_TASK_FILTERS);
            }}
            teamMembers={teamMembers}
            shown={visibleTasks.length}
            totalTasks={tasks.length}
          />
        </div>
      )}

      {visibleTasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Ninguna tarea coincide con los filtros.
        </p>
      ) : placed === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          Ninguna tarea del equipo cuelga todavía de la estructura.
        </p>
      ) : (
        tree.map((node) => <Node key={node.id} node={node} depth={0} cb={cb} />)
      )}

      {looseTasks.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fuera de la estructura
          </p>
          {looseTasks.map((task) => (
            <TaskLeaf
              key={task.id}
              task={task}
              today={today}
              projectId={projectId}
              teamMembers={teamMembers}
              canReview={canReview}
              onOpen={
                onOpenTask
                  ? () => {
                      onOpenTask(task);
                    }
                  : undefined
              }
              onDeliver={
                onDeliverTask && (canDeliverTask?.(task) ?? true)
                  ? () => {
                      onDeliverTask(task);
                    }
                  : undefined
              }
              onMarkDelivered={
                onMarkDeliveredTask && (canDeliverTask?.(task) ?? true)
                  ? () => {
                      onMarkDeliveredTask(task);
                    }
                  : undefined
              }
              onReassigned={onReassigned}
            />
          ))}
        </div>
      )}
    </div>
  );
}
