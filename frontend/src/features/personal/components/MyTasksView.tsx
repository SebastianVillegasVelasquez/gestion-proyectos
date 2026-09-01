import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, FolderTree, Users2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import type { ApiMyTask } from "../api/personal.api";
import {
  dueStatus,
  DUE_STATUS_CLASSES,
  DUE_STATUS_LABELS,
  type DueStatus,
} from "../utils/due-status";

type Filter = "todas" | "overdue" | "due_soon" | "abiertas" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "overdue", label: "Vencidas" },
  { key: "due_soon", label: "Por vencer" },
  { key: "abiertas", label: "Abiertas" },
  { key: "done", label: "Completadas" },
];

function matches(filter: Filter, status: DueStatus): boolean {
  switch (filter) {
    case "todas":
      return true;
    case "overdue":
      return status === "overdue";
    case "due_soon":
      return status === "due_soon";
    case "done":
      return status === "done";
    case "abiertas":
      return status !== "done";
  }
}

/**
 * «Mis tareas»: todo lo asignado al usuario (individual o de equipo), con el
 * aviso de vencimiento y la vía de entrega según el tipo de tarea:
 *  - individual → se entrega aquí mismo (crea/abre su entrega personal)
 *  - de equipo  → se entrega en el espacio de ese equipo (enlace)
 */
export function MyTasksView({
  tasks,
  loading,
  deliverableTaskIds,
  onOpenIndividual,
}: {
  tasks: ApiMyTask[];
  loading: boolean;
  /** ids de tareas que ya tienen una entrega personal (para el texto del botón). */
  deliverableTaskIds: Set<string>;
  onOpenIndividual: (task: ApiMyTask) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [filter, setFilter] = useState<Filter>("abiertas");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .map((t) => ({ task: t, status: dueStatus(t, today) }))
      .filter(({ status }) => matches(filter, status))
      .filter(
        ({ task }) =>
          !q || task.title.toLowerCase().includes(q) || task.project_name.toLowerCase().includes(q),
      );
  }, [tasks, filter, query, today]);

  const counts = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    for (const t of tasks) {
      const s = dueStatus(t, today);
      if (s === "overdue") {
        overdue += 1;
      } else if (s === "due_soon") {
        dueSoon += 1;
      }
    }
    return { overdue, dueSoon };
  }, [tasks, today]);

  const byProject = useMemo(() => {
    const groups = new Map<string, { name: string; items: typeof rows }>();
    for (const row of rows) {
      const g = groups.get(row.task.project_id) ?? {
        name: row.task.project_name,
        items: [],
      };
      g.items.push(row);
      groups.set(row.task.project_id, g);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  if (loading) {
    return (
      <div className="flex-1">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={CalendarClock}
          title="No tienes tareas asignadas"
          hint="Cuando te asignen una tarea —individual o de un equipo— aparecerá aquí."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
              }}
              aria-pressed={filter === f.key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              {f.key === "overdue" && counts.overdue > 0 && (
                <span className="ml-1 font-bold text-rose-500">{counts.overdue}</span>
              )}
              {f.key === "due_soon" && counts.dueSoon > 0 && (
                <span className="ml-1 font-bold text-amber-500">{counts.dueSoon}</span>
              )}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Buscar por tarea o proyecto…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand-gold"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border">
        {byProject.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nada que coincida con el filtro.
          </p>
        ) : (
          byProject.map((group) => (
            <section key={group.name}>
              <h3 className="sticky top-0 z-10 bg-accent/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {group.name}
              </h3>
              <ul className="divide-y divide-border">
                {group.items.map(({ task, status }) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
                  >
                    <span className="min-w-[160px] flex-1 truncate text-sm font-medium text-foreground">
                      {task.title}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        DUE_STATUS_CLASSES[status],
                      )}
                      title={task.due_date ? `Vence el ${task.due_date}` : undefined}
                    >
                      {DUE_STATUS_LABELS[status]}
                      {task.due_date && status !== "done" && ` · ${task.due_date}`}
                    </span>

                    <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                      {task.team_id ? (
                        <>
                          <Users2 className="size-3" /> {task.team_name}
                        </>
                      ) : (
                        <>
                          <FolderTree className="size-3" /> {task.work_item_name ?? "Individual"}
                        </>
                      )}
                    </span>

                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {TASK_STATUS_LABELS[task.status]}
                    </span>

                    {status === "done" ? null : task.team_id ? (
                      <Link
                        to={`/workspace?team=${task.team_id}`}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                      >
                        Entregar en el equipo <ArrowUpRight className="inline size-3" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenIndividual(task);
                        }}
                        className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark"
                      >
                        {deliverableTaskIds.has(task.id) ? "Ver entrega" : "Entregar"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
