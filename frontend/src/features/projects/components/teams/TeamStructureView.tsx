import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FolderTree,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateRange, taskRisk } from "../../utils/task-dates";
import type { Task, WorkItemTree } from "../../types/api.types";

/** Lo que la vista de estructura necesita de una tarea. Sirve tanto para `Task`
 * del proyecto como para `ApiTeamTask` del workspace (misma forma). */
export type StructureTask = Pick<
  Task,
  "id" | "title" | "status" | "start_date" | "due_date" | "work_item_id"
>;

/** Pastilla de fechas: es lo que la vista quiere que salte a la vista, así que
 * va grande, en `tabular-nums` y tintada según el riesgo de calendario. */
function DateTag({ task, today }: { task: StructureTask; today: string }) {
  const risk = taskRisk(task, today);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold tabular-nums",
        risk === "vencida"
          ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          : risk === "por_vencer"
            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            : "border-border bg-accent text-muted-foreground",
      )}
    >
      {risk === "vencida" && <AlertTriangle className="size-3" />}
      {formatDateRange(task.start_date, task.due_date)}
    </span>
  );
}

function TaskLine({
  task,
  who,
  today,
  onOpen,
  onDeliver,
  onMarkDelivered,
}: {
  task: StructureTask;
  who: string;
  today: string;
  onOpen?: () => void;
  /** "Entregar con adjunto": abre el modal de nuevo entregable. */
  onDeliver?: () => void;
  /** "Entregar sin adjunto": pasa la tarea a revisión sin crear entregable. */
  onMarkDelivered?: () => void;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{task.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{who}</span>
      </span>
      <DateTag task={task} today={today} />
    </>
  );
  const cls =
    "flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left";
  const clickable = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cn(cls, "transition-colors hover:border-brand-gold/40 hover:bg-accent/40")}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );

  if (!onDeliver && !onMarkDelivered) {
    return clickable;
  }
  return (
    <div className="flex items-center gap-1.5">
      {clickable}
      {onDeliver && (
        <button
          type="button"
          onClick={onDeliver}
          title="Entregar con un adjunto (crea un entregable revisable)"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2 py-1.5 text-xs font-semibold text-brand-gold-dark transition-colors hover:bg-brand-gold/20 dark:text-brand-gold"
        >
          <UploadCloud className="size-3.5" />
          Entregar
        </button>
      )}
      {onMarkDelivered && (
        <button
          type="button"
          onClick={onMarkDelivered}
          title="Marcar como entregada sin adjunto (pasa a revisión)"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
        >
          <Check className="size-3.5" />
          Sin adjunto
        </button>
      )}
    </div>
  );
}

/** Un nodo de la estructura con sus tareas del equipo; se pliega y se salta si
 * ni él ni su descendencia tienen trabajo de este equipo. */
function Node<T extends StructureTask>({
  node,
  depth,
  tasksByItem,
  countInSubtree,
  resolveWho,
  today,
  onOpenTask,
  onDeliverTask,
  onMarkDeliveredTask,
  canDeliverTask,
}: {
  node: WorkItemTree;
  depth: number;
  tasksByItem: Map<string, T[]>;
  countInSubtree: Map<string, number>;
  resolveWho: (task: T) => string;
  today: string;
  onOpenTask?: (task: T) => void;
  onDeliverTask?: (task: T) => void;
  onMarkDeliveredTask?: (task: T) => void;
  canDeliverTask?: (task: T) => boolean;
}) {
  const [open, setOpen] = useState(true);
  const total = countInSubtree.get(node.id) ?? 0;
  if (total === 0) {
    return null;
  }

  const own = tasksByItem.get(node.id) ?? [];

  return (
    <div className={cn(depth > 0 && "border-l border-border pl-3")}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <FolderTree className="size-3.5 shrink-0 text-brand-gold" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {node.nombre}
        </span>
        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {total}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 pb-1.5">
          {own.map((task) => (
            <TaskLine
              key={task.id}
              task={task}
              who={resolveWho(task)}
              today={today}
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
            />
          ))}
          {node.children.map((child) => (
            <Node
              key={child.id}
              node={child}
              depth={depth + 1}
              tasksByItem={tasksByItem}
              countInSubtree={countInSubtree}
              resolveWho={resolveWho}
              today={today}
              onOpenTask={onOpenTask}
              onDeliverTask={onDeliverTask}
              onMarkDeliveredTask={onMarkDeliveredTask}
              canDeliverTask={canDeliverTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * La estructura del proyecto vista desde un equipo: qué elemento tiene qué
 * tareas, quién responde por cada una y —lo que importa aquí— en qué fechas,
 * remarcadas y tintadas por riesgo. Recibe las tareas ya acotadas al equipo.
 */
export function TeamStructureView<T extends StructureTask>({
  tree,
  tasks,
  resolveWho,
  onOpenTask,
  onDeliverTask,
  onMarkDeliveredTask,
  canDeliverTask,
  today,
}: {
  tree: WorkItemTree[];
  tasks: T[];
  resolveWho: (task: T) => string;
  onOpenTask?: (task: T) => void;
  /** Si se pasa, cada tarea muestra un botón "Entregar" (atajo al modal de
   * nuevo entregable). `canDeliverTask` acota a qué tareas se les ofrece. */
  onDeliverTask?: (task: T) => void;
  onMarkDeliveredTask?: (task: T) => void;
  canDeliverTask?: (task: T) => boolean;
  today: string;
}) {
  const tasksByItem = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const task of tasks) {
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
  }, [tasks]);

  // Cuántas tareas del equipo cuelgan de cada nodo contando su descendencia:
  // así se sabe de un vistazo qué ramas plegar y cuáles saltar enteras.
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

  const looseTasks = tasks.filter((t) => !t.work_item_id);
  const placed = tasks.length - looseTasks.length;

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        Este equipo aún no tiene tareas en la estructura.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {placed === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          Ninguna tarea del equipo cuelga todavía de la estructura.
        </p>
      ) : (
        tree.map((node) => (
          <Node
            key={node.id}
            node={node}
            depth={0}
            tasksByItem={tasksByItem}
            countInSubtree={countInSubtree}
            resolveWho={resolveWho}
            today={today}
            onOpenTask={onOpenTask}
            onDeliverTask={onDeliverTask}
            onMarkDeliveredTask={onMarkDeliveredTask}
            canDeliverTask={canDeliverTask}
          />
        ))
      )}

      {looseTasks.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fuera de la estructura
          </p>
          {looseTasks.map((task) => (
            <TaskLine
              key={task.id}
              task={task}
              who={resolveWho(task)}
              today={today}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
