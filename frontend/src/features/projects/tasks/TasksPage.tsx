import { useMemo, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router";
import {
  Plus,
  Moon,
  Sun,
  ListChecks,
  AlertTriangle,
  CalendarClock,
  Search,
  LayoutGrid,
  List,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../hooks/use-projects";
import { useProjectTasks, useChangeTaskStatus } from "../hooks/use-tasks";
import { useDirectory, useProjectMembers } from "../hooks/use-members";
import { useTeams } from "../hooks/use-teams";
import { useWorkTree } from "../hooks/use-structure";
import { tipoStyle } from "../utils/tipo-style";
import { colorForName } from "../utils/entity-color";
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "../types/labels";
import type { Task, TaskStatus, WorkItemTree } from "../types/api.types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TasksTable } from "./TasksTable";
import { TaskDetailPanel } from "../gantt/components/TaskDetailPanel";

const COLUMNS: { id: TaskStatus; label: string; dot: string; badge: string }[] = [
  {
    id: "pendiente_por_iniciar",
    label: "Pendiente",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    id: "en_progreso",
    label: "En progreso",
    dot: "bg-brand-teal",
    badge: "bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal",
  },
  {
    id: "en_revision",
    label: "En revisión",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  {
    id: "completada",
    label: "Completada",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
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

function isOverdue(task: Task): boolean {
  return (
    task.status !== "completada" &&
    task.status !== "cancelada" &&
    task.due_date != null &&
    task.due_date < new Date().toISOString().slice(0, 10)
  );
}

// Las tareas sin planificar no tienen fecha: mostramos un guion en su lugar.
function formatDate(iso: string | null): string {
  if (!iso) {
    return "Sin fecha";
  }
  const [, m, d] = iso.split("-");
  return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(m) - 1]}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Aplana el árbol de estructura a un mapa id → {nombre, tipoId}, para el tag
 * de ubicación de cada tarjeta de tarea. */
function flattenLocations(nodes: WorkItemTree[]): Map<string, { name: string; tipoId: string }> {
  const map = new Map<string, { name: string; tipoId: string }>();
  const visit = (node: WorkItemTree) => {
    map.set(node.id, { name: node.nombre, tipoId: node.tipo_id });
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return map;
}

function TaskCard({
  task,
  location,
  teamName,
  assignee,
  subtasks,
  draggable,
  onDragStart,
  onClick,
}: {
  task: Task;
  location: { name: string; tipoId: string } | undefined;
  teamName: string | undefined;
  assignee: string | undefined;
  subtasks: { done: number; total: number };
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const overdue = isOverdue(task);
  const completed = task.status === "completada";
  const locationStyle = location ? tipoStyle(location.tipoId) : null;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-grab flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-brand-gold/40 hover:shadow-lg active:cursor-grabbing",
        completed && "opacity-80 hover:opacity-100",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {completed ? (
          <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="size-3" /> Lista
          </span>
        ) : (
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide",
              TASK_PRIORITY_COLORS[task.priority],
            )}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
        )}
      </div>

      <p
        className={cn(
          "text-[14.5px] font-bold leading-snug text-foreground",
          completed && "text-muted-foreground line-through decoration-muted-foreground/50",
        )}
      >
        {task.title}
      </p>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      {location && (
        <span
          className={cn(
            "w-fit rounded-md px-2 py-0.5 text-[10.5px] font-bold",
            locationStyle?.chip,
          )}
        >
          {location.name}
        </span>
      )}

      {task.status === "en_progreso" && subtasks.total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
            <span>Progreso</span>
            <span>{Math.round((subtasks.done / subtasks.total) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-brand-blue"
              style={{ width: `${(subtasks.done / subtasks.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-accent/70 pt-2.5">
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-semibold text-muted-foreground",
            overdue && "font-bold text-rose-500",
          )}
        >
          {overdue ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <CalendarClock className="size-3.5" />
          )}
          {formatDate(task.due_date)}
        </span>
        <div className="flex items-center gap-2">
          {subtasks.total > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <ListChecks className="size-3.5" />
              {subtasks.done}/{subtasks.total}
            </span>
          )}
          {teamName && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                colorForName(teamName),
              )}
            >
              {teamName}
            </span>
          )}
          {assignee && (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-[10px] font-extrabold text-brand-blue-dark dark:text-brand-blue">
              {initials(assignee)}
            </span>
          )}
        </div>
      </div>
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
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);
  const changeStatus = useChangeTaskStatus(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // La tabla editable es la vista principal de tareas (más flexible que el kanban).
  const [view, setView] = useState<"kanban" | "lista">("lista");
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  // Deriva del listado en vivo (no una copia local) para que el panel refleje
  // cambios como adjuntar/quitar de la estructura sin cerrarse y reabrirse.
  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return tasks;
    }
    return tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const assigneeName = useMemo(() => {
    const map = new Map<string, string>();
    (directoryQuery.data ?? []).forEach((u) => map.set(u.id, `${u.name} ${u.last_name}`));
    return map;
  }, [directoryQuery.data]);

  const teamName = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data?.items ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const locationById = useMemo(() => flattenLocations(treeQuery.data ?? []), [treeQuery.data]);

  // Subtareas: tareas cuyo parent_task_id apunta a esta. done/total por padre.
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks) {
      if (!task.parent_task_id) {
        continue;
      }
      const entry = map.get(task.parent_task_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (task.status === "completada") {
        entry.done += 1;
      }
      map.set(task.parent_task_id, entry);
    }
    return map;
  }, [tasks]);

  const byColumn = useMemo(() => {
    const groups = new Map<TaskStatus, Task[]>(COLUMNS.map((c) => [c.id, []]));
    for (const task of filtered) {
      groups.get(STATUS_COLUMN[task.status])?.push(task);
    }
    return groups;
  }, [filtered]);

  const handleDrop = (column: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || STATUS_COLUMN[task.status] === column) {
      return;
    }
    changeStatus.mutate({ taskId, status: column });
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
      <header className="flex shrink-0 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {projectQuery.data?.name ?? "Proyecto"}
          </button>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <ListChecks className="size-5 text-emerald-600" /> Tareas
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Buscar tarea…"
                aria-label="Buscar tarea"
                className="w-48 rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 sm:w-64"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => {
                  setView("kanban");
                }}
                aria-pressed={view === "kanban"}
                aria-label="Vista kanban"
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors",
                  view === "kanban"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("lista");
                }}
                aria-pressed={view === "lista"}
                aria-label="Vista de lista"
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors",
                  view === "lista"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-brand-gold-dark"
            >
              <Plus className="size-4" /> Nueva tarea
            </button>
          </div>
        </div>
      </header>

      {tasksQuery.isLoading ? (
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          {COLUMNS.map((c) => (
            <div key={c.id} className="h-40 animate-pulse rounded-2xl bg-accent" />
          ))}
        </div>
      ) : view === "lista" ? (
        <TasksTable
          projectId={projectId}
          tasks={filtered}
          members={membersQuery.data ?? []}
          teams={teamsQuery.data?.items ?? []}
          locationById={locationById}
          onOpenDetail={(id) => {
            setSelectedId(id);
          }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => {
                  setDragOverCol((c) => (c === col.id ? null : c));
                }}
                onDrop={(e) => {
                  handleDrop(col.id, e);
                }}
                className={cn(
                  "flex min-h-0 flex-col gap-3 rounded-2xl transition-colors",
                  dragOverCol === col.id && "bg-accent/50 ring-2 ring-brand-gold/40",
                )}
              >
                <div className="flex shrink-0 items-center gap-2 px-1">
                  <span className={cn("size-2 shrink-0 rounded-full", col.dot)} />
                  <span className="text-[14.5px] font-bold text-foreground">{col.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", col.badge)}>
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 overflow-y-auto px-0.5 pb-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-2 text-xs italic text-muted-foreground">Sin tareas</p>
                  ) : (
                    items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        location={
                          task.work_item_id ? locationById.get(task.work_item_id) : undefined
                        }
                        assignee={task.assignee_id ? assigneeName.get(task.assignee_id) : undefined}
                        teamName={task.team_id ? teamName.get(task.team_id) : undefined}
                        subtasks={subtasksByParent.get(task.id) ?? { done: 0, total: 0 }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", task.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => {
                          setSelectedId(task.id);
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
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
