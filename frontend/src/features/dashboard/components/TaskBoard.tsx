import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Task, TaskStatus } from "../types";

interface ColumnConfig {
  status: TaskStatus;
  label: string;
  dotClass: string;
  countClass: string;
}

const columns: ColumnConfig[] = [
  {
    status: "pending",
    label: "Pendiente",
    dotClass: "bg-amber-400",
    countClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  {
    status: "in-progress",
    label: "En progreso",
    dotClass: "bg-blue-500",
    countClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  },
  {
    status: "completed",
    label: "Completado",
    dotClass: "bg-emerald-500",
    countClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
];

const tagVariantClasses = {
  project:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  date:
    "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
};

function TaskCard({ task }: { task: Task }) {
  const isCompleted = task.status === "completed";
  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors duration-150",
        "border-slate-200 bg-slate-50 hover:border-slate-300",
        "dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600",
        isCompleted && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 size-2 shrink-0 rounded-full",
            task.status === "pending"     && "bg-amber-400",
            task.status === "in-progress" && "bg-blue-500",
            task.status === "completed"   && "bg-emerald-500"
          )}
        />
        <p
          className={cn(
            "text-[13px] leading-snug text-slate-700 dark:text-slate-200",
            isCompleted && "line-through decoration-slate-400 dark:decoration-slate-500"
          )}
        >
          {task.title}
        </p>
      </div>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.tags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                tagVariantClasses[tag.variant]
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ config, tasks }: { config: ColumnConfig; tasks: Task[] }) {
  return (
    /* Each column fills the grid row height and scrolls its task list independently */
    <div className="flex min-h-0 flex-col gap-2 lg:h-full">
      {/* Column header — fixed */}
      <div className="flex shrink-0 items-center gap-2 pb-1">
        <span className={cn("size-2 rounded-full", config.dotClass)} />
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
          {config.label}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            config.countClass
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task list — scrollable on desktop */}
      <div className="flex flex-col gap-2 overflow-y-auto lg:flex-1 lg:min-h-0">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="py-4 text-center text-[12px] text-slate-400 dark:text-slate-600">
            Sin tareas
          </p>
        )}
      </div>
    </div>
  );
}

interface TaskBoardProps {
  tasks: Task[];
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    /* flex-1 + min-h-0 so this card fills the flex cell in DashboardPage row 2 */
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-sm font-semibold">Tablero de tareas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col overflow-hidden pt-0">
        <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-3 lg:h-full lg:gap-3">
          {columns.map((col) => (
            <Column key={col.status} config={col} tasks={byStatus(col.status)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
