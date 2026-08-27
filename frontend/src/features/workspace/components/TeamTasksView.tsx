import { useMemo, useState } from "react";
import {
  CalendarRange,
  CornerDownRight,
  FolderKanban,
  LayoutGrid,
  Link2Off,
  List,
  ListTodo,
  Plus,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { useTeamTasks, useWorkspaceAccess } from "../hooks/use-workspace";
import { NewSubtaskModal } from "./NewSubtaskModal";
import type { ApiTeamTask } from "../api/workspace.api";
import type { WorkspaceMember } from "../types";
import {
  STATUS_META,
  activeBlockers,
  buildTaskRows,
  daysUntilDue,
  formatDueDate,
  groupTeamTasks,
  isOverdue,
  taskProgressPct,
  urgencyMeta,
  type TaskGrouping,
  type TaskTreeRow,
} from "../utils/team-tasks";
import { TeamGanttPanel } from "./TeamGanttPanel";

type ViewMode = "lista" | "kanban" | "cronograma";

// El "hoy" se calcula una vez por render del componente raíz y baja como prop:
// así todas las filas comparan contra la misma fecha (si cada fila llamara a
// `new Date()`, un render a medianoche podría mezclar dos días).
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Piezas compartidas entre Lista y Kanban ─────────────────────────────────

function Avatar({ member, name }: { member?: WorkspaceMember; name: string }) {
  const initials = member?.initials ?? name.slice(0, 2).toUpperCase();
  return (
    <span
      title={name}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
        member?.avatarColor ?? "bg-slate-400",
      )}
    >
      {initials}
    </span>
  );
}

function ProgressBar({ task, className }: { task: ApiTeamTask; className?: string }) {
  const pct = taskProgressPct(task.status);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all", STATUS_META[task.status].bar)}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ task }: { task: ApiTeamTask }) {
  const meta = STATUS_META[task.status];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  );
}

function UrgencyBadge({ task }: { task: ApiTeamTask }) {
  const meta = urgencyMeta(task.priority);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  );
}

/**
 * Indicador de bloqueo. El título de la tarea bloqueante puede ser larguísimo,
 * así que va en un contenedor `min-w-0` con `truncate` y su texto completo en
 * el `title`: nunca empuja ni se superpone a las columnas vecinas.
 */
function BlockedBy({ task }: { task: ApiTeamTask }) {
  const blockers = activeBlockers(task);
  if (blockers.length === 0) {
    return null;
  }
  const [first] = blockers;
  const extra = blockers.length - 1;
  const full = blockers.map((b) => b.title).join(" · ");

  return (
    <span
      title={`Bloqueada por: ${full}`}
      className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-500"
    >
      {/* Conector punto-línea-punto del diseño: comunica "esta va después de aquella". */}
      <span aria-hidden className="flex shrink-0 items-center gap-0.5">
        <span className="size-1 rounded-full bg-current" />
        <span className="h-px w-2.5 bg-current" />
        <span className="size-1 rounded-full bg-current" />
      </span>
      <span className="shrink-0">Bloqueada por:</span>
      <span className="min-w-0 flex-1 truncate">{first.title}</span>
      {extra > 0 && <span className="shrink-0 font-semibold">+{extra}</span>}
    </span>
  );
}

function DueDate({ task, today }: { task: ApiTeamTask; today: string }) {
  const overdue = isOverdue(task, today);
  const days = daysUntilDue(task.due_date, today);
  // "Vence en 2 d" es más accionable que una fecha suelta, pero solo cuando la
  // fecha está cerca; más allá de una semana, la fecha dice más.
  const soon = days !== null && days >= 0 && days <= 7;

  return (
    <span
      title={task.due_date ? `Fecha de entrega: ${formatDueDate(task.due_date)}` : "Sin planificar"}
      className={cn(
        "text-[11px] tabular-nums",
        overdue
          ? "font-semibold text-rose-600 dark:text-rose-400"
          : "text-slate-400 dark:text-slate-500",
      )}
    >
      {/* `soon` ya implica que `days` no es null; TS lo estrecha por el alias. */}
      {overdue && days !== null
        ? `Vencida ${String(Math.abs(days))} d`
        : soon
          ? `En ${String(days)} d`
          : formatDueDate(task.due_date)}
    </span>
  );
}

// ── Vista Lista ─────────────────────────────────────────────────────────────

function TaskRow({
  row,
  today,
  canReview,
  onAddSubtask,
}: {
  row: TaskTreeRow;
  today: string;
  canReview: boolean;
  onAddSubtask: (task: ApiTeamTask) => void;
}) {
  const { task, depth, detachedParentTitle } = row;
  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-t border-slate-100 py-2.5 pr-4 first:border-t-0 dark:border-slate-800",
        // Las subtareas se tiñen para que el bloque padre+hijas se lea como una
        // unidad aunque la indentación sea sutil.
        depth > 0 && "bg-slate-50/60 dark:bg-slate-800/20",
      )}
      // Indentación por nivel: la misma lectura que la estructura del proyecto.
      style={{ paddingLeft: `${String(1 + depth * 1.4)}rem` }}
    >
      {/* Columna elástica: es la única que cede espacio, por eso lleva min-w-0. */}
      <div className="min-w-0 flex-1">
        <p
          className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200"
          title={task.title}
        >
          {depth > 0 && (
            <CornerDownRight
              aria-label="Subtarea"
              className="size-3.5 shrink-0 text-slate-300 dark:text-slate-600"
            />
          )}
          <span className="truncate">{task.title}</span>
        </p>
        <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
          {/* Cuando el padre cayó en otro grupo, decimos de cuál cuelga: sin
              esto la subtarea aparecería suelta y sin contexto. */}
          {detachedParentTitle !== null && (
            <span className="text-slate-400 dark:text-slate-500">
              Subtarea de «{detachedParentTitle}» ·{" "}
            </span>
          )}
          {task.work_item_name ?? "Sin elemento"} · {task.project_name}
        </p>
        <BlockedBy task={task} />
      </div>

      {/* Anchos fijos: las columnas quedan alineadas entre filas y grupos. */}
      <ProgressBar task={task} className="w-[120px] shrink-0" />
      <span className="w-[88px] shrink-0 text-right">
        <DueDate task={task} today={today} />
      </span>
      <span className="flex w-[100px] shrink-0 justify-center">
        <StatusBadge task={task} />
      </span>
      <span className="flex w-[76px] shrink-0 justify-center">
        <UrgencyBadge task={task} />
      </span>

      {/* Solo en tareas raíz y para el líder: partir una tarea general en subtareas. */}
      {task.parent_task_id === null && canReview ? (
        <button
          type="button"
          onClick={() => {
            onAddSubtask(task);
          }}
          title="Agregar subtarea"
          aria-label={`Agregar subtarea a ${task.title}`}
          className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-all hover:bg-brand-teal/10 hover:text-brand-teal-dark focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-brand-teal"
        >
          <Plus className="size-4" />
        </button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
    </div>
  );
}

function ListView({
  groups,
  allTasks,
  members,
  grouping,
  today,
  canReview,
  onAddSubtask,
}: {
  groups: ReturnType<typeof groupTeamTasks>;
  /** Todas las del equipo: resuelven el título de un padre fuera del grupo. */
  allTasks: ApiTeamTask[];
  members: WorkspaceMember[];
  grouping: TaskGrouping;
  today: string;
  canReview: boolean;
  onAddSubtask: (task: ApiTeamTask) => void;
}) {
  return (
    // `h-full` es lo que hace que este contenedor scrollee: sin altura propia
    // crecía con el contenido y el padre `overflow-hidden` recortaba el final
    // de la lista sin mostrar barra de desplazamiento.
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {groups
        // Agrupando por estado hay columnas vacías a propósito (ver utils), pero
        // en Lista una sección vacía solo es ruido vertical.
        .filter((g) => g.tasks.length > 0)
        .map((group) => {
          const member = members.find((m) => m.id === group.key);
          return (
            <section
              key={group.key}
              // `shrink-0` es lo que hace scrollear la lista. Sin el, cada
              // tarjeta es un flex item que se ENCOGE para caber en el alto
              // disponible y su `overflow-hidden` (el que redondea las
              // esquinas) recorta en silencio las tareas que sobran: el padre
              // nunca desborda, asi que tampoco muestra barra.
              className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <header className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                <div className="flex min-w-0 items-center gap-2">
                  {grouping === "integrante" ? (
                    <Avatar member={member} name={group.label} />
                  ) : (
                    <FolderKanban className="size-4 shrink-0 text-brand-teal" />
                  )}
                  <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {group.label}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                    · {group.tasks.length} tarea{group.tasks.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {group.doneCount}/{group.tasks.length}
                </span>
              </header>
              <div>
                {buildTaskRows(group.tasks, allTasks).map((row) => (
                  <TaskRow
                    key={row.task.id}
                    row={row}
                    today={today}
                    canReview={canReview}
                    onAddSubtask={onAddSubtask}
                  />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}

// ── Vista Kanban ────────────────────────────────────────────────────────────

function TaskCard({
  task,
  parentTitle,
  members,
  today,
}: {
  task: ApiTeamTask;
  /** Título del padre cuando la tarjeta es una subtarea. */
  parentTitle: string | null;
  members: WorkspaceMember[];
  today: string;
}) {
  const member = members.find((m) => m.id === task.assignee_id);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-200"
          title={task.title}
        >
          {task.title}
        </p>
        <UrgencyBadge task={task} />
      </div>

      {parentTitle !== null && (
        <p
          className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-slate-500"
          title={`Subtarea de ${parentTitle}`}
        >
          <CornerDownRight className="size-3 shrink-0" />
          <span className="truncate">{parentTitle}</span>
        </p>
      )}
      <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
        {task.work_item_name ?? "Sin elemento"}
      </p>

      <BlockedBy task={task} />
      <ProgressBar task={task} className="mt-2.5" />

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar member={member} name={task.assignee_name ?? "Sin responsable"} />
          <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
            {task.assignee_name ?? "Sin responsable"}
          </span>
        </div>
        <DueDate task={task} today={today} />
      </div>
    </article>
  );
}

function KanbanView({
  groups,
  allTasks,
  members,
  today,
}: {
  groups: ReturnType<typeof groupTeamTasks>;
  allTasks: ApiTeamTask[];
  members: WorkspaceMember[];
  today: string;
}) {
  const titleById = new Map(allTasks.map((t) => [t.id, t.title]));
  return (
    // Scroll horizontal propio del tablero: la página nunca se desplaza en X.
    <div className="flex h-full gap-3 overflow-x-auto p-4 sm:p-6">
      {groups.map((group) => (
        <section key={group.key} className="flex w-[280px] shrink-0 flex-col">
          <header className="flex items-center justify-between gap-2 rounded-t-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="truncate text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              {group.label}
            </p>
            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {group.tasks.length}
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border border-t-0 border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/30">
            {group.tasks.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] text-slate-300 dark:text-slate-600">
                Sin tareas
              </p>
            ) : (
              group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  parentTitle={
                    task.parent_task_id === null
                      ? null
                      : (titleById.get(task.parent_task_id) ?? "otra tarea")
                  }
                  members={members}
                  today={today}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Controles ───────────────────────────────────────────────────────────────

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; Icon?: React.ElementType }[];
  onChange: (value: T) => void;
  label: string;
}

/**
 * Control segmentado genérico. Genérico y no dos componentes distintos porque
 * "Lista/Kanban" y "Por integrante/Por estado" son el mismo widget con
 * distintos valores; el genérico mantiene el tipado exacto de cada uno.
 */
function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const { Icon } = opt;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(opt.value);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              active
                ? "bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

interface TeamTasksViewProps {
  teamId: string;
  /** Proyecto del equipo: el cronograma cuelga de su estructura. */
  projectId: string;
  members: WorkspaceMember[];
}

/**
 * Tareas reales delegadas al equipo, en Lista o Kanban y agrupadas por
 * integrante o por estado. Todo lo que se ve —avance, urgencia, fecha,
 * bloqueos— sale del modelo de tareas del proyecto: es la MISMA tarea que ven
 * el cronograma y la trazabilidad, no una copia del equipo.
 */
export function TeamTasksView({ teamId, projectId, members }: TeamTasksViewProps) {
  const query = useTeamTasks(teamId);
  const accessQuery = useWorkspaceAccess(teamId);
  const canReview = accessQuery.data?.can_review ?? false;

  const [view, setView] = useState<ViewMode>("lista");
  const [grouping, setGrouping] = useState<TaskGrouping>("integrante");
  const [subtaskParent, setSubtaskParent] = useState<ApiTeamTask | null>(null);

  const today = useMemo(() => todayIso(), []);
  const tasks = useMemo(() => query.data ?? [], [query.data]);
  // En Kanban la agrupación por estado ES el tablero; agrupar por integrante
  // dentro de columnas de estado no tendría dónde ir.
  const effectiveGrouping: TaskGrouping = view === "lista" ? grouping : "estado";
  const groups = useMemo(
    () => groupTeamTasks(tasks, effectiveGrouping),
    [tasks, effectiveGrouping],
  );
  const blockedCount = useMemo(
    () => tasks.filter((t) => activeBlockers(t).length > 0).length,
    [tasks],
  );

  if (query.isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudieron cargar las tareas del equipo"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={FolderKanban}
          title="Este equipo aún no tiene tareas delegadas"
          hint="Cuando se le asigne una tarea al equipo, aparecerá aquí con su avance, urgencia y bloqueos."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Barra de controles */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <Segmented
          label="Modo de vista"
          value={view}
          onChange={setView}
          options={[
            { value: "lista", label: "Lista", Icon: List },
            { value: "kanban", label: "Kanban", Icon: LayoutGrid },
            { value: "cronograma", label: "Cronograma", Icon: CalendarRange },
          ]}
        />

        {view === "lista" && (
          <Segmented
            label="Agrupar tareas por"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: "integrante", label: "Por integrante", Icon: Users2 },
              { value: "estado", label: "Por estado", Icon: ListTodo },
            ]}
          />
        )}

        <div className="flex-1" />

        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
        </span>
        {blockedCount > 0 && (
          <span
            title="Tareas que esperan a que otra termine (dependencia fin-inicio)"
            className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          >
            <Link2Off className="size-3" />
            {blockedCount} bloqueada{blockedCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {view === "lista" && (
          <ListView
            groups={groups}
            allTasks={tasks}
            members={members}
            grouping={effectiveGrouping}
            today={today}
            canReview={canReview}
            onAddSubtask={setSubtaskParent}
          />
        )}
        {view === "kanban" && (
          <KanbanView groups={groups} allTasks={tasks} members={members} today={today} />
        )}
        {view === "cronograma" && <TeamGanttPanel projectId={projectId} teamId={teamId} />}
      </div>

      {subtaskParent && (
        <NewSubtaskModal
          teamId={teamId}
          parent={subtaskParent}
          onClose={() => {
            setSubtaskParent(null);
          }}
        />
      )}
    </div>
  );
}
