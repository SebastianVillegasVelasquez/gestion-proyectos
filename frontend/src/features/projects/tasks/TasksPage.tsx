import { useMemo, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router";
import { Plus, Moon, Sun, ListChecks, AlertTriangle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../hooks/use-projects";
import { useProjectTasks } from "../hooks/use-tasks";
import { useDirectory } from "../hooks/use-members";
import { TASK_STATUS_LABELS } from "../types/labels";
import type { Task, TaskStatus } from "../types/api.types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailPanel } from "../gantt/components/TaskDetailPanel";

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "pendiente_por_iniciar", label: "Pendiente", accent: "border-t-slate-400" },
  { id: "en_progreso", label: "En progreso", accent: "border-t-brand-teal" },
  { id: "en_revision", label: "En revisión", accent: "border-t-amber-400" },
  { id: "completada", label: "Completada", accent: "border-t-emerald-500" },
];

// A qué columna cae cada estado.
const STATUS_COLUMN: Record<TaskStatus, TaskStatus> = {
  pendiente_por_iniciar: "pendiente_por_iniciar",
  en_progreso: "en_progreso",
  en_revision: "en_revision",
  devuelta: "en_revision",
  completada: "completada",
  cancelada: "completada",
};

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-rose-500",
  alta: "bg-orange-500",
  media: "bg-amber-400",
  baja: "bg-slate-400",
  no_definida: "bg-slate-300",
};

function isOverdue(task: Task): boolean {
  return (
    task.status !== "completada" &&
    task.status !== "cancelada" &&
    task.due_date < new Date().toISOString().slice(0, 10)
  );
}

function TaskCard({
  task,
  assignee,
  onClick,
}: {
  task: Task;
  assignee: string | undefined;
  onClick: () => void;
}) {
  const overdue = isOverdue(task);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-gold/40 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-gold/40"
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} />
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className={cn("flex items-center gap-1", overdue && "font-medium text-rose-500")}>
          {overdue ? <AlertTriangle className="size-3" /> : <CalendarClock className="size-3" />}
          {task.due_date}
        </span>
        {assignee && <span className="ml-auto truncate">{assignee}</span>}
      </div>
      {task.status !== STATUS_COLUMN[task.status] && (
        <span className="w-fit rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          {TASK_STATUS_LABELS[task.status]}
        </span>
      )}
    </button>
  );
}

export function TasksPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const tasksQuery = useProjectTasks(projectId);
  const directoryQuery = useDirectory();

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const assigneeName = useMemo(() => {
    const map = new Map<string, string>();
    (directoryQuery.data ?? []).forEach((u) => map.set(u.id, `${u.name} ${u.last_name}`));
    return map;
  }, [directoryQuery.data]);

  const byColumn = useMemo(() => {
    const groups = new Map<TaskStatus, Task[]>(COLUMNS.map((c) => [c.id, []]));
    for (const task of tasks) {
      groups.get(STATUS_COLUMN[task.status])?.push(task);
    }
    return groups;
  }, [tasks]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="mb-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            ← {projectQuery.data?.name ?? "Proyecto"}
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            <ListChecks className="size-5 text-emerald-600" /> Tareas
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            <Plus className="size-4" /> Nueva tarea
          </button>
        </div>
      </header>

      {tasksQuery.isLoading ? (
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          {COLUMNS.map((c) => (
            <div
              key={c.id}
              className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                className={cn(
                  "flex min-h-0 flex-col rounded-lg border-t-2 bg-slate-50 dark:bg-slate-900/50",
                  col.accent,
                )}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {col.label}
                  </span>
                  <span className="rounded-full bg-slate-200 px-1.5 text-[11px] text-slate-500 dark:bg-slate-700">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-3">
                  {items.length === 0 ? (
                    <p className="px-1 py-2 text-xs italic text-slate-400">Sin tareas</p>
                  ) : (
                    items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        assignee={task.assignee_id ? assigneeName.get(task.assignee_id) : undefined}
                        onClick={() => {
                          setSelected(task);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          projectId={projectId}
          tasks={tasks}
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}
      {selected && (
        <TaskDetailPanel
          projectId={projectId}
          task={selected}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
