import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { groupMyTasksByProject } from "../utils/group-my-tasks";
import { formatShortDate } from "../utils/transform-panels";
import type { DashboardTaskItem } from "../types";

/**
 * Las tareas asignadas a la persona, agrupadas por proyecto.
 *
 * El tablero de al lado las ordena por estado (pendiente / en progreso /
 * hecha), que responde a "¿cómo va la cosa?". Esta tarjeta responde a la otra
 * pregunta, la de quien va a ponerse a trabajar: "¿qué me toca, y de qué
 * proyecto?". Por eso los proyectos con tareas vencidas salen arriba.
 */
export function MyTasksByProject({
  tasks,
  today,
}: {
  tasks: DashboardTaskItem[];
  /** Fecha de hoy en ISO (YYYY-MM-DD), para marcar lo vencido. */
  today: string;
}) {
  const groups = groupMyTasksByProject(tasks, today);
  const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-brand-teal" />
          Mis tareas por proyecto
          {total > 0 && (
            <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
              {total}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-0">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No tienes tareas pendientes asignadas.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.projectId ?? group.projectName} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {group.projectId ? (
                  <Link
                    to={`/proyectos/${group.projectId}/progreso`}
                    className="group flex min-w-0 items-center gap-1 text-[13px] font-semibold text-foreground hover:text-brand-teal-dark dark:hover:text-brand-teal"
                  >
                    <span className="truncate">{group.projectName}</span>
                    <ChevronRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ) : (
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {group.projectName}
                  </span>
                )}
                {group.overdue > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                    <AlertTriangle className="size-2.5" />
                    {group.overdue} vencida{group.overdue !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {group.tasks.length}
                </span>
              </div>

              <ul className="flex flex-col gap-1">
                {group.tasks.map((task) => {
                  const overdue = task.due_date !== null && task.due_date < today;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          overdue ? "bg-rose-500" : "bg-amber-400",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        {task.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] tabular-nums",
                          overdue
                            ? "font-semibold text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatShortDate(task.due_date)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
