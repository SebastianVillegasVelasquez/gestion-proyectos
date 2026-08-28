import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderTree,
  History,
  LayoutGrid,
  List,
  Search,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/common/AsyncStates";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useProjectMemberProgress, useProjectMembers } from "../../hooks/use-members";
import { useProject } from "../../hooks/use-projects";
import { memberSchedule, SCHEDULE_BADGE, type MemberSchedule } from "../../utils/member-schedule";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useWorkTree } from "../../hooks/use-structure";
import { useTeamMembers, useTeams } from "../../hooks/use-teams";
import { GanttView } from "../../gantt/components/GanttView";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TEAM_ROLE_ACCENT,
  TEAM_ROLE_LABELS,
  positionLabel,
} from "../../types/labels";
import { fullName, indexById, initialsOf } from "../../utils/task-assignment";
import { formatDateRange, isOverdue, rangeOfTasks } from "../../utils/task-dates";
import { collectItemPaths } from "../../utils/work-item-path";
import { TaskDetailModal } from "../detail/TaskDetailModal";
import { TeamKanban } from "./TeamKanban";
import { TeamStructureView } from "./TeamStructureView";
import { TraceabilityPanel } from "../detail/TraceabilityPanel";
import type { ProjectMember, Task, TaskStatus, Team, TeamMember } from "../../types/api.types";

/** Tope de tareas visibles antes de mandar al modal con toda la lista. */
const TASK_CAP = 5;

type Scope = "equipo" | "personas";
type ViewMode = "listas" | "kanban" | "estructura" | "trazabilidad";

const VIEW_TABS: { value: ViewMode; label: string; Icon: typeof List }[] = [
  { value: "listas", label: "Listas", Icon: List },
  { value: "kanban", label: "Tablero", Icon: LayoutGrid },
  { value: "estructura", label: "Estructura", Icon: FolderTree },
  { value: "trazabilidad", label: "Trazabilidad", Icon: History },
];

/** Ruta «padre › módulo › **unidad**» del elemento del que cuelga una tarea. */
function TaskCrumb({ path }: { path: string[] }) {
  if (path.length === 0) {
    return null;
  }
  return (
    <span className="truncate text-[11px] text-muted-foreground" title={path.join(" › ")}>
      {path.slice(0, -1).map((name) => (
        <span key={name}>{name} › </span>
      ))}
      <span className="font-semibold text-foreground/70">{path[path.length - 1]}</span>
    </span>
  );
}

/** Fila compacta de tarea: título, de dónde cuelga, responsable, lapso y estado.
 * Abre la ficha al pulsar. */
function TaskRow({
  task,
  who,
  path,
  onOpen,
}: {
  task: Task;
  /** Responsable resuelto (persona o equipo); vacío si no aplica. */
  who?: string;
  /** Ruta del elemento de la estructura, raíz→hoja. */
  path?: string[];
  onOpen: () => void;
}) {
  const late = isOverdue(task);
  const done = task.status === "completada";
  const hasSubline = (path && path.length > 0) || Boolean(who);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Ver la ficha de «${task.title}»`}
      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-brand-gold/40 hover:bg-accent/40"
    >
      <ClipboardList className="size-3.5 shrink-0 text-brand-gold" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm text-foreground",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        {hasSubline && (
          <span className="flex min-w-0 items-center gap-1.5">
            {path && path.length > 0 && <TaskCrumb path={path} />}
            {path && path.length > 0 && who && (
              <span className="shrink-0 text-muted-foreground/40">·</span>
            )}
            {who && <span className="truncate text-[11px] text-muted-foreground">{who}</span>}
          </span>
        )}
      </span>
      <span
        className={cn(
          "hidden shrink-0 items-center gap-1 text-[11px] tabular-nums sm:flex",
          late ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        )}
      >
        {late ? <AlertTriangle className="size-3" /> : <CalendarRange className="size-3" />}
        {formatDateRange(task.start_date, task.due_date)}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          TASK_STATUS_COLORS[task.status],
        )}
      >
        {TASK_STATUS_LABELS[task.status]}
      </span>
    </button>
  );
}

/** Resumen de un lapso: «12/03/26 → 20/03/26», o el aviso de que no hay fechas. */
function SpanBadge({ tasks, label }: { tasks: Task[]; label: string }) {
  const { start, due } = rangeOfTasks(tasks);
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <CalendarRange className="size-3.5" />
      <span className="font-normal">{label}</span>
      {start || due ? formatDateRange(start, due) : "sin fechas"}
    </span>
  );
}

/** De dónde cuelga una tarea y quién responde por ella, para adornar la fila. */
type RowDecor = (task: Task) => { who?: string; path?: string[] };

/** Lista de tareas con tope: pasado `TASK_CAP`, ofrece abrir el modal completo. */
function TaskList({
  tasks,
  emptyLabel,
  decorate,
  onOpenTask,
  onShowAll,
}: {
  tasks: Task[];
  emptyLabel: string;
  decorate?: RowDecor;
  onOpenTask: (task: Task) => void;
  onShowAll: () => void;
}) {
  if (tasks.length === 0) {
    return <p className="py-1 text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <>
      {tasks.slice(0, TASK_CAP).map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          {...decorate?.(task)}
          onOpen={() => {
            onOpenTask(task);
          }}
        />
      ))}
      {tasks.length > TASK_CAP && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-0.5 self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-gold-dark transition-colors hover:bg-accent dark:text-brand-gold"
        >
          Mostrar {tasks.length - TASK_CAP} más…
        </button>
      )}
    </>
  );
}

/** Modal con TODAS las tareas de un ámbito y filtros para juzgar cómo van. */
function TaskBrowserModal({
  title,
  tasks,
  decorate,
  onOpenTask,
  onClose,
}: {
  title: string;
  tasks: Task[];
  decorate?: RowDecor;
  onOpenTask: (task: Task) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskStatus | "todos" | "atrasadas">("todos");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (needle && !t.title.toLowerCase().includes(needle)) {
        return false;
      }
      if (status === "atrasadas") {
        return isOverdue(t);
      }
      return status === "todos" || t.status === status;
    });
  }, [tasks, q, status]);

  const done = tasks.filter((t) => t.status === "completada").length;
  const late = tasks.filter((t) => isOverdue(t)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {done}/{tasks.length} completadas · {late} atrasadas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent"
          >
            Cerrar
          </button>
        </header>
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-border px-4 py-2.5">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
              }}
              placeholder="Buscar tarea…"
              aria-label="Buscar tarea"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs text-foreground outline-none transition focus:border-brand-gold"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus | "todos" | "atrasadas");
            }}
            aria-label="Filtrar por estado"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-brand-gold"
          >
            <option value="todos">Todos los estados</option>
            <option value="atrasadas">Atrasadas</option>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-4">
          {shown.length === 0 ? (
            <p className="py-2 text-center text-sm italic text-muted-foreground">
              Nada coincide con el filtro.
            </p>
          ) : (
            shown.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                {...decorate?.(task)}
                onOpen={() => {
                  onOpenTask(task);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Estado de calendario del integrante (solo lo ve quien administra). */
function MemberHealth({
  schedule,
  progressPct,
}: {
  schedule: MemberSchedule;
  progressPct: number | null;
}) {
  const badge = SCHEDULE_BADGE[schedule.status];
  const bar = progressPct ?? schedule.actualPct;
  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", badge.cls)}>
          {badge.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Real {schedule.actualPct}% · Esperado {schedule.expectedPct}%
          {schedule.overdue > 0 &&
            ` · ${schedule.overdue} vencida${schedule.overdue > 1 ? "s" : ""}`}
          {schedule.dueSoon > 0 && ` · ${schedule.dueSoon} por vencer`}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-brand-blue transition-all"
          style={{ width: `${Math.min(100, bar)}%` }}
        />
        {/* Marca del avance esperado: si la barra la deja a la izquierda, va bien. */}
        <span
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/50"
          style={{ left: `${Math.min(100, schedule.expectedPct)}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/** Bloque plegable de un integrante con sus tareas individuales. */
function MemberBlock({
  member,
  tasks,
  schedule,
  progressPct,
  canManage,
  decorate,
  onOpenTask,
  onShowAll,
}: {
  member: TeamMember;
  tasks: Task[];
  schedule: MemberSchedule;
  progressPct: number | null;
  canManage: boolean;
  decorate?: RowDecor;
  onOpenTask: (task: Task) => void;
  onShowAll: () => void;
}) {
  // Colapsado por defecto: la vista arranca compacta y cada quien despliega el
  // integrante que le interesa.
  const [open, setOpen] = useState(false);
  const done = tasks.filter((t) => t.status === "completada").length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            TEAM_ROLE_ACCENT[member.team_role],
          )}
        >
          {initialsOf(member)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {fullName(member)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {positionLabel(member.position)}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
            TEAM_ROLE_ACCENT[member.team_role],
          )}
        >
          {TEAM_ROLE_LABELS[member.team_role]}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {done}/{tasks.length} tareas
        </span>
        <SpanBadge tasks={tasks} label="" />
      </button>

      {canManage && <MemberHealth schedule={schedule} progressPct={progressPct} />}

      {open && (
        <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
          <TaskList
            tasks={tasks}
            emptyLabel="Sin tareas propias en este proyecto."
            decorate={decorate}
            onOpenTask={onOpenTask}
            onShowAll={onShowAll}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Qué trabajo tiene un equipo y en qué plazos.
 *
 * Separa dos cosas que se confunden a diario: lo que está delegado AL EQUIPO
 * (sin dueño concreto todavía, típico del líder que aún no repartió) y lo que
 * cada integrante lleva a título individual. El lapso se muestra en los dos
 * niveles porque la pregunta "¿para cuándo?" se hace igual del equipo entero
 * que de una persona.
 *
 * Todo se cruza en la vista a partir de las tareas del proyecto: no hay un
 * endpoint de "tareas del equipo" y crearlo solo para esto sería duplicar en el
 * backend un filtro que aquí es una línea.
 */
export function TeamWorkPanel({
  projectId,
  team,
  viewerUserId,
}: {
  projectId: string;
  team: Team;
  /**
   * Cuando llega, el panel se muestra en modo "solo lo mío" (vista del rol
   * User): sin selector de alcance, con el trabajo delegado al equipo y solo el
   * bloque de esta persona. Sin él, comportamiento normal (gestión).
   */
  viewerUserId?: string;
}) {
  const { hasRole, user } = useAuth();
  const canManage = hasRole(["admin", "super_admin"]);
  const soloMine = Boolean(viewerUserId);
  const viewerId = viewerUserId ?? user?.id ?? null;

  const tasksQuery = useProjectTasks(projectId);
  const teamMembersQuery = useTeamMembers(projectId, team.id);
  const projectMembersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);
  const projectQuery = useProject(projectId);
  // Avance ponderado por profundidad de la estructura (curso → módulo → tarea):
  // el mismo número que la vista de Integrantes, reutilizado, no recalculado.
  const progressQuery = useProjectMemberProgress(canManage ? projectId : undefined);

  const [scope, setScope] = useState<Scope>("equipo");
  const [viewMode, setViewMode] = useState<ViewMode>("listas");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [showGantt, setShowGantt] = useState(false);
  const [browse, setBrowse] = useState<{ title: string; tasks: Task[] } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const members = useMemo(() => teamMembersQuery.data ?? [], [teamMembersQuery.data]);
  // En modo "solo lo mío" el listado por integrante se recorta a quien mira.
  const visibleMembers = useMemo(
    () => (viewerUserId ? members.filter((m) => m.user_id === viewerUserId) : members),
    [members, viewerUserId],
  );

  const memberById = useMemo(
    () => indexById<ProjectMember>(projectMembersQuery.data ?? [], (m) => m.user_id),
    [projectMembersQuery.data],
  );
  const teamById = useMemo(
    () => indexById<Team>(teamsQuery.data?.items ?? [], (t) => t.id),
    [teamsQuery.data],
  );
  const itemPathById = useMemo(() => collectItemPaths(treeQuery.data ?? []), [treeQuery.data]);
  const progressByUser = useMemo(
    () => new Map((progressQuery.data ?? []).map((m) => [m.user_id, m.progress_pct])),
    [progressQuery.data],
  );

  /** Delegadas al equipo como tal (tengan o no responsable dentro). */
  const teamTasks = useMemo(() => tasks.filter((t) => t.team_id === team.id), [tasks, team.id]);

  /** Tareas por integrante. Se recorre una sola vez y se agrupa por
   * responsable, en vez de filtrar la lista completa por cada persona. */
  const tasksByMember = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const member of members) {
      map.set(member.user_id, []);
    }
    for (const task of tasks) {
      if (task.assignee_id) {
        map.get(task.assignee_id)?.push(task);
      }
    }
    return map;
  }, [tasks, members]);

  const individualTasks = useMemo(() => [...tasksByMember.values()].flat(), [tasksByMember]);

  /** Todo el trabajo que toca a este equipo, sin contar dos veces una tarea
   * que esté a la vez delegada al equipo y asignada a alguien de dentro. */
  const allTasks = useMemo(() => {
    const seen = new Map<string, Task>();
    for (const task of [...teamTasks, ...individualTasks]) {
      seen.set(task.id, task);
    }
    return [...seen.values()];
  }, [teamTasks, individualTasks]);

  /** Quién responde por una tarea, en texto corto para filas y tarjetas. */
  const resolveWho = (task: Task): string => {
    if (task.assignee_id) {
      const m = memberById.get(task.assignee_id);
      return m ? fullName(m) : "Responsable externo";
    }
    if (task.team_id && task.team_id !== team.id) {
      return teamById.get(task.team_id)?.name ?? "Otro equipo";
    }
    return "Sin responsable";
  };
  const pathOf = (task: Task): string[] =>
    task.work_item_id ? (itemPathById.get(task.work_item_id) ?? []) : [];
  const decorate: RowDecor = (task) => ({ who: resolveWho(task), path: pathOf(task) });
  const decoratePath: RowDecor = (task) => ({ path: pathOf(task) });

  // El líder/supervisor del equipo puede reasignar tareas entre los suyos; un
  // admin también. El integrante raso, no.
  const myTeamRole = members.find((m) => m.user_id === viewerId)?.team_role;
  const canAssign = canManage || myTeamRole === "lider" || myTeamRole === "supervisor";
  const assignableMembers = canAssign ? members : undefined;

  // Tablero y estructura: el líder ve todo el trabajo del equipo; el integrante,
  // solo lo suyo.
  const focusTasks = soloMine && viewerId ? (tasksByMember.get(viewerId) ?? []) : allTasks;

  if (tasksQuery.isLoading || teamMembersQuery.isLoading) {
    return <LoadingSkeleton rows={3} />;
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ClipboardList className="size-4 text-brand-gold" />
          Trabajo del equipo
        </h3>
        <SpanBadge tasks={allTasks} label="Lapso total:" />
        <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {allTasks.length} {allTasks.length === 1 ? "tarea" : "tareas"}
        </span>

        {/* Cómo se mira el mismo trabajo: listas, tablero, estructura o historial. */}
        <div
          role="tablist"
          aria-label="Vista del trabajo del equipo"
          className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-card p-1"
        >
          {VIEW_TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={viewMode === value}
              onClick={() => {
                setViewMode(value);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                viewMode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Selector de alcance: solo aplica a la vista de listas de gestión. */}
        {!soloMine && viewMode === "listas" && (
          <div
            role="tablist"
            aria-label="Alcance de las tareas"
            className="flex items-center gap-1 rounded-xl border border-border bg-card p-1"
          >
            {(
              [
                ["equipo", `Del equipo (${teamTasks.length})`],
                ["personas", `Por integrante (${individualTasks.length})`],
              ] as [Scope, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={scope === value}
                onClick={() => {
                  setScope(value);
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  scope === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Cronograma del equipo: se abre a pantalla completa —recortado a lo que
          este equipo tiene asignado— para que quepa con sus filtros (persona,
          tipo de elemento, en riesgo, estado). */}
      {projectQuery.data && (
        <>
          <button
            type="button"
            onClick={() => {
              setShowGantt(true);
            }}
            className="flex items-center gap-2 self-start rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <CalendarRange className="size-4 text-brand-gold" />
            Abrir cronograma del equipo
          </button>
          {showGantt && (
            <div className="fixed inset-0 z-50 flex flex-col bg-background">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarRange className="size-4 text-brand-gold" />
                  Cronograma · {team.name}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowGantt(false);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent"
                >
                  Cerrar
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <GanttView project={projectQuery.data} embed={{ teamId: team.id }} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tablero del equipo ─────────────────────────────────────────────── */}
      {viewMode === "kanban" && (
        <TeamKanban
          tasks={focusTasks}
          resolveWho={resolveWho}
          pathOf={pathOf}
          onOpenTask={setOpenTask}
          today={today}
        />
      )}

      {/* ── Estructura: quién tiene qué y en qué fechas ─────────────────────── */}
      {viewMode === "estructura" && (
        <TeamStructureView
          tree={treeQuery.data ?? []}
          tasks={focusTasks}
          resolveWho={resolveWho}
          onOpenTask={setOpenTask}
          today={today}
        />
      )}

      {/* ── Trazabilidad acotada a este equipo (también la ve el admin) ─────── */}
      {viewMode === "trazabilidad" && (
        <TraceabilityPanel projectId={projectId} lockedTeamId={team.id} />
      )}

      {/* Trabajo delegado al equipo como tal (visible siempre en modo "solo lo
          mío"; con selector, cuando el alcance es "equipo"). */}
      {viewMode === "listas" && (soloMine || scope === "equipo") && (
        <div className="flex flex-col gap-1.5">
          {soloMine && (
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Del equipo
            </h4>
          )}
          {teamTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Ninguna tarea está delegada al equipo como tal. Al asignar una tarea a «{team.name}»
              sin responsable individual, aparecerá aquí.
            </p>
          ) : (
            <TaskList
              tasks={teamTasks}
              emptyLabel=""
              decorate={decorate}
              onOpenTask={setOpenTask}
              onShowAll={() => {
                setBrowse({ title: `Tareas del equipo · ${team.name}`, tasks: teamTasks });
              }}
            />
          )}
        </div>
      )}

      {/* Bloques por integrante. En modo "solo lo mío" se recorta a la persona
          que mira; con selector, cuando el alcance es "por integrante". */}
      {viewMode === "listas" &&
        (soloMine || scope === "personas") &&
        (visibleMembers.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            <UsersRound className="size-4" />
            {soloMine
              ? "Aún no tienes tareas propias en este equipo."
              : "El equipo todavía no tiene integrantes."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {soloMine && (
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mis tareas
              </h4>
            )}
            {visibleMembers.map((member) => {
              const memberTasks = tasksByMember.get(member.user_id) ?? [];
              return (
                <MemberBlock
                  key={member.user_id}
                  member={member}
                  tasks={memberTasks}
                  schedule={memberSchedule(memberTasks, today)}
                  progressPct={progressByUser.get(member.user_id) ?? null}
                  canManage={canManage}
                  decorate={decoratePath}
                  onOpenTask={setOpenTask}
                  onShowAll={() => {
                    setBrowse({ title: `Tareas de ${fullName(member)}`, tasks: memberTasks });
                  }}
                />
              );
            })}
          </div>
        ))}

      {browse && (
        <TaskBrowserModal
          title={browse.title}
          tasks={browse.tasks}
          decorate={decorate}
          onOpenTask={setOpenTask}
          onClose={() => {
            setBrowse(null);
          }}
        />
      )}

      {openTask && (
        <TaskDetailModal
          projectId={projectId}
          task={openTask}
          containerName={pathOf(openTask).join(" › ") || null}
          memberById={memberById}
          teamById={teamById}
          assignableMembers={assignableMembers}
          onClose={() => {
            setOpenTask(null);
          }}
        />
      )}
    </section>
  );
}
