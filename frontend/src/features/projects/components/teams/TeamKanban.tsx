import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildTeamBoard } from "../../utils/team-board";
import { formatDateRange, taskRisk } from "../../utils/task-dates";
import type { Task } from "../../types/api.types";

function Breadcrumb({ path }: { path: string[] }) {
  if (path.length === 0) {
    return null;
  }
  const leaf = path[path.length - 1];
  const ancestors = path.slice(0, -1);
  return (
    <p className="truncate text-[11px] text-muted-foreground" title={path.join(" › ")}>
      {ancestors.map((name) => (
        <span key={name}>{name} › </span>
      ))}
      <span className="font-semibold text-foreground/80">{leaf}</span>
    </p>
  );
}

function Card({
  task,
  who,
  path,
  today,
  onOpen,
}: {
  task: Task;
  who: string;
  path: string[];
  today: string;
  onOpen: () => void;
}) {
  const risk = taskRisk(task, today);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5 text-left transition-shadow hover:shadow-md"
    >
      <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
        {task.title}
      </span>
      <Breadcrumb path={path} />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{who}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            risk === "vencida"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
              : risk === "por_vencer"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "text-muted-foreground",
          )}
        >
          {risk === "vencida" && <AlertTriangle className="size-2.5" />}
          {formatDateRange(task.start_date, task.due_date)}
        </span>
      </div>
    </button>
  );
}

/**
 * Tablero del equipo. El líder lo ve con todo el trabajo del equipo; el
 * integrante, con solo lo suyo (el panel decide qué `tasks` le pasa). Las
 * columnas son los estados MÁS una lane «En riesgo» al frente, tintada de rojo,
 * que se lleva las tareas abiertas vencidas o por vencer (ver `buildTeamBoard`).
 */
export function TeamKanban({
  tasks,
  resolveWho,
  pathOf,
  onOpenTask,
  today,
}: {
  tasks: Task[];
  resolveWho: (task: Task) => string;
  pathOf: (task: Task) => string[];
  onOpenTask: (task: Task) => void;
  today: string;
}) {
  const columns = useMemo(() => buildTeamBoard(tasks, today), [tasks, today]);

  return (
    // Scroll horizontal propio del tablero: la página nunca se desplaza en X.
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <section key={col.key} className="flex w-[260px] shrink-0 flex-col">
          <header
            className={cn(
              "flex items-center justify-between gap-2 rounded-t-lg border px-3 py-2",
              col.atRisk
                ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                : "border-border bg-accent/50",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1 truncate text-[12px] font-semibold",
                col.atRisk ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
              )}
            >
              {col.atRisk && <AlertTriangle className="size-3.5 shrink-0" />}
              {col.label}
            </span>
            <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {col.tasks.length}
            </span>
          </header>
          <div
            className={cn(
              "flex min-h-[80px] flex-1 flex-col gap-2 rounded-b-lg border border-t-0 p-2",
              col.atRisk ? "border-rose-200 dark:border-rose-900" : "border-border",
            )}
          >
            {col.tasks.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-muted-foreground/60">
                Sin tareas
              </p>
            ) : (
              col.tasks.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  who={resolveWho(task)}
                  path={pathOf(task)}
                  today={today}
                  onOpen={() => {
                    onOpenTask(task);
                  }}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
