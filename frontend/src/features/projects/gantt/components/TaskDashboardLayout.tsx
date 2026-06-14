import { useState, useCallback } from "react";
import { ArrowLeft, Plus, Sun, Moon, CalendarDays, Activity } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "../types";
import { TASK_STATUS_LABELS, STATUS_BADGE } from "../types";
import type { TaskHistory } from "../traceability/types";
import type { StoredProject } from "../../context/ProjectsContext";
import { useProjectsContext } from "../../context/ProjectsContext";
import { CustomGanttViewer } from "./CustomGanttViewer";
import { TaskSlideoverPanel } from "./TaskSlideoverPanel";
import { TraceabilityDashboard } from "../traceability/TraceabilityDashboard";

// ── tab types ─────────────────────────────────────────────────────────────

type ActiveTab = "gantt" | "traceability";

const TABS: { id: ActiveTab; label: string; Icon: React.ElementType }[] = [
  { id: "gantt", label: "Cronograma", Icon: CalendarDays },
  { id: "traceability", label: "Trazabilidad", Icon: Activity },
];

// ── status summary strip ──────────────────────────────────────────────────

const STATUS_ORDER: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

function StatsStrip({ tasks }: { tasks: Task[] }) {
  const counts = STATUS_ORDER.reduce<Record<TaskStatus, number>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const nonZero = STATUS_ORDER.filter((s) => counts[s] > 0);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Tareas
      </span>
      <span className="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {tasks.length}
      </span>
      {nonZero.length > 0 && (
        <>
          <span className="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
          {nonZero.map((s) => (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                STATUS_BADGE[s]
              )}
            >
              {TASK_STATUS_LABELS[s]}
              <span className="font-bold">{counts[s]}</span>
            </span>
          ))}
        </>
      )}
      {tasks.length === 0 && (
        <span className="italic text-[11px] text-slate-400 dark:text-slate-500">
          Crea tu primera tarea →
        </span>
      )}
    </div>
  );
}

// ── history generator ─────────────────────────────────────────────────────

function buildHistoryEntry(
  task: Task,
  prevTask: Task | undefined,
  actorId: string,
  changeReason: string
): TaskHistory {
  let action: TaskHistory["action"] = "comentario";
  if (!prevTask) {
    action = "creacion";
  } else if (prevTask.assignee_id !== task.assignee_id) {
    action = "reasignacion";
  } else if (prevTask.status !== task.status) {
    action = "cambio_estado";
  }

  return {
    id: crypto.randomUUID(),
    task_id: task.id,
    changed_by_id: actorId,
    action,
    old_status: prevTask?.status ?? null,
    new_status: task.status,
    change_reason: changeReason,
    created_at: new Date().toISOString(),
  };
}

// ── main layout ───────────────────────────────────────────────────────────

interface TaskDashboardLayoutProps {
  stored: StoredProject;
  dark: boolean;
  onToggleDark: () => void;
}

export function TaskDashboardLayout({
  stored,
  dark,
  onToggleDark,
}: TaskDashboardLayoutProps) {
  const navigate = useNavigate();
  const { setTasks, addHistoryEntry } = useProjectsContext();

  const [tasks, setLocalTasks] = useState<Task[]>(stored.tasks);
  const [activeTab, setActiveTab] = useState<ActiveTab>("gantt");

  // Slideover
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // ── handlers ─────────────────────────────────────────────────────────────

  const openNewTask = useCallback(() => {
    setEditingTask(null);
    setPanelOpen(true);
  }, []);

  const openEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => { setEditingTask(null); }, 320);
  }, []);

  const handleSaveTask = useCallback(
    (task: Task, changeReason: string) => {
      const prevTask = tasks.find((t) => t.id === task.id);
      const isNew = !prevTask;
      const next = isNew
        ? [...tasks, task]
        : tasks.map((t) => (t.id === task.id ? task : t));

      // Determine if this mutation is worth recording
      const shouldLog =
        isNew ||
        prevTask?.status !== task.status ||
        prevTask?.assignee_id !== task.assignee_id ||
        Boolean(changeReason);

      if (shouldLog) {
        const actorId = stored.members[0]?.id ?? "system";
        const entry = buildHistoryEntry(task, prevTask, actorId, changeReason);
        addHistoryEntry(stored.id, entry);
      }

      setLocalTasks(next);
      setTasks(stored.id, next);
      closePanel();
    },
    [tasks, stored.id, stored.members, setTasks, addHistoryEntry, closePanel]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const next = tasks.filter((t) => t.id !== taskId);
      setLocalTasks(next);
      setTasks(stored.id, next);
      closePanel();
    },
    [tasks, stored.id, setTasks, closePanel]
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* ─ Header ─ */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => navigate(`/projects/${stored.id}`)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Volver al proyecto"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${stored.id}`)}
            className="truncate text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {stored.project.name || "Proyecto sin nombre"}
          </button>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            Tareas &amp; Cronograma
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={dark ? "Modo claro" : "Modo oscuro"}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {activeTab === "gantt" && (
            <button
              type="button"
              onClick={openNewTask}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
            >
              <Plus className="size-3.5" />
              Nueva tarea
            </button>
          )}
        </div>
      </header>

      {/* ─ Tab bar ─ */}
      <div className="flex shrink-0 items-end gap-1 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveTab(id); }}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-2.5 text-[13px] font-medium transition-colors",
              activeTab === id
                ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─ Stats strip (only on Gantt tab) ─ */}
      {activeTab === "gantt" && <StatsStrip tasks={tasks} />}

      {/* ─ Content ─ */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "gantt" ? (
          <CustomGanttViewer
            tasks={tasks}
            nodes={stored.nodes}
            members={stored.members}
            onClickTask={openEditTask}
          />
        ) : (
          <TraceabilityDashboard stored={{ ...stored, tasks }} />
        )}
      </div>

      {/* ─ Slide-over panel ─ */}
      <TaskSlideoverPanel
        isOpen={panelOpen}
        task={editingTask}
        nodes={stored.nodes}
        members={stored.members}
        onClose={closePanel}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
