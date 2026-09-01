import { useMemo } from "react";
import { useNavigate } from "react-router";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/common/Skeleton";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "../../types/api.types";

// Estados abiertos: una tarea completada o cancelada ya no "vence".
const OPEN: TaskStatus[] = ["pendiente_por_iniciar", "en_progreso", "en_revision", "devuelta"];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dueInfo(due: string): { text: string; tone: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) {
    return {
      text: `Venció hace ${Math.abs(days)} d`,
      tone: "text-rose-600 dark:text-rose-400",
      urgent: true,
    };
  }
  if (days === 0) {
    return { text: "Vence hoy", tone: "text-amber-600 dark:text-amber-400", urgent: true };
  }
  if (days <= 7) {
    return {
      text: `En ${days} día${days === 1 ? "" : "s"}`,
      tone: "text-amber-600 dark:text-amber-400",
      urgent: false,
    };
  }
  return { text: `En ${days} días`, tone: "text-muted-foreground", urgent: false };
}

function chip(due: string): { day: string; month: string } {
  const [, m, d] = due.split("-");
  return { day: d, month: MONTHS[Number(m) - 1] };
}

export function UpcomingDeadlinesCard({
  projectId,
  tasks,
  loading = false,
}: {
  projectId: string;
  tasks: Task[];
  /** Las tareas aún no llegaron: la tarjeta se dibuja igual, con sus huecos. */
  loading?: boolean;
}) {
  const navigate = useNavigate();

  const items = useMemo(
    () =>
      tasks
        .filter((t) => t.due_date != null && OPEN.includes(t.status))
        .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
        .slice(0, 5),
    [tasks],
  );

  return (
    <Card className="flex flex-1 flex-col rounded-2xl">
      <CardContent className="flex h-full flex-col gap-4 py-5 sm:pt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <CalendarClock className="size-[18px]" />
            </span>
            Próximos vencimientos
          </span>
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}/tareas`)}
            className="flex items-center gap-0.5 text-xs font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
          >
            Ver tareas <ChevronRight className="size-3.5" />
          </button>
        </div>

        {loading ? (
          // Cinco huecos con la forma de una fila de vencimiento: al llegar
          // los datos ocupan el mismo sitio y nada salta.
          <div className="flex flex-1 flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <CalendarClock className="size-7 text-muted-foreground/40" />
            <p className="text-sm italic text-muted-foreground">
              No hay tareas con fecha pendiente.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((task) => {
              const info = dueInfo(task.due_date!);
              const c = chip(task.due_date!);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => void navigate(`/projects/${projectId}/tareas`)}
                    className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
                        info.urgent
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-accent text-foreground",
                      )}
                    >
                      <span className="text-base font-semibold tabular-nums">{c.day}</span>
                      <span className="text-[10px] font-medium uppercase">{c.month}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className={cn("text-xs font-medium", info.tone)}>{info.text}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
