import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/common/AsyncStates";
import { useProjectMembers } from "../../hooks/use-members";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useWorkTree } from "../../hooks/use-structure";
import { useTeamMembers, useTeams } from "../../hooks/use-teams";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TEAM_ROLE_ACCENT,
  TEAM_ROLE_LABELS,
  positionLabel,
} from "../../types/labels";
import { fullName, indexById, initialsOf } from "../../utils/task-assignment";
import { formatDateRange, isOverdue, rangeOfTasks } from "../../utils/task-dates";
import { TaskDetailModal } from "../detail/TaskDetailModal";
import type { ProjectMember, Task, Team, TeamMember, WorkItemTree } from "../../types/api.types";

/** Nombre de cada elemento de la estructura por id, para poder decir de dónde
 * cuelga una tarea sin volver a pedirlo al backend. */
function collectItemNames(nodes: WorkItemTree[], into: Map<string, string>): Map<string, string> {
  for (const node of nodes) {
    into.set(node.id, node.nombre);
    collectItemNames(node.children, into);
  }
  return into;
}

type Scope = "equipo" | "personas";

/** Fila compacta de tarea: título, lapso y estado. Abre la ficha al pulsar. */
function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const late = isOverdue(task);
  const done = task.status === "completada";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Ver la ficha de «${task.title}»`}
      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-brand-gold/40 hover:bg-accent/40"
    >
      <ClipboardList className="size-3.5 shrink-0 text-brand-gold" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-foreground",
          done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
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

/** Bloque plegable de un integrante con sus tareas individuales. */
function MemberBlock({
  member,
  tasks,
  onOpenTask,
}: {
  member: TeamMember;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  // Abierto por defecto solo si tiene trabajo: así la lista no arranca llena de
  // secciones vacías cuando el equipo aún no ha repartido nada.
  const [open, setOpen] = useState(tasks.length > 0);
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

      {open && (
        <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5">
          {tasks.length === 0 ? (
            <p className="py-1 text-sm italic text-muted-foreground">
              Sin tareas propias en este proyecto.
            </p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => {
                  onOpenTask(task);
                }}
              />
            ))
          )}
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
export function TeamWorkPanel({ projectId, team }: { projectId: string; team: Team }) {
  const tasksQuery = useProjectTasks(projectId);
  const teamMembersQuery = useTeamMembers(projectId, team.id);
  const projectMembersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);

  const [scope, setScope] = useState<Scope>("equipo");
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const members = useMemo(() => teamMembersQuery.data ?? [], [teamMembersQuery.data]);

  const memberById = useMemo(
    () => indexById<ProjectMember>(projectMembersQuery.data ?? [], (m) => m.user_id),
    [projectMembersQuery.data],
  );
  const teamById = useMemo(
    () => indexById<Team>(teamsQuery.data?.items ?? [], (t) => t.id),
    [teamsQuery.data],
  );
  const itemNameById = useMemo(
    () => collectItemNames(treeQuery.data ?? [], new Map<string, string>()),
    [treeQuery.data],
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

  if (tasksQuery.isLoading || teamMembersQuery.isLoading) {
    return <LoadingSkeleton rows={3} />;
  }

  const shown = scope === "equipo" ? teamTasks : individualTasks;

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

        {/* Selector de alcance: el mismo equipo se mira de dos maneras. */}
        <div
          role="tablist"
          aria-label="Alcance de las tareas"
          className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-card p-1"
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
      </header>

      {scope === "equipo" ? (
        <div className="flex flex-col gap-1.5">
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Ninguna tarea está delegada al equipo como tal. Al asignar una tarea a «{team.name}»
              sin responsable individual, aparecerá aquí.
            </p>
          ) : (
            shown.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => {
                  setOpenTask(task);
                }}
              />
            ))
          )}
        </div>
      ) : members.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          <UsersRound className="size-4" />
          El equipo todavía no tiene integrantes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <MemberBlock
              key={member.user_id}
              member={member}
              tasks={tasksByMember.get(member.user_id) ?? []}
              onOpenTask={setOpenTask}
            />
          ))}
        </div>
      )}

      {openTask && (
        <TaskDetailModal
          projectId={projectId}
          task={openTask}
          containerName={
            openTask.work_item_id ? (itemNameById.get(openTask.work_item_id) ?? null) : null
          }
          memberById={memberById}
          teamById={teamById}
          onClose={() => {
            setOpenTask(null);
          }}
        />
      )}
    </section>
  );
}
