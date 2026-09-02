import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  Filter,
  FolderKanban,
  History,
  LayoutGrid,
  List,
  ListTodo,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { useNodeTypes, useWorkTree } from "@/features/projects/hooks/use-structure";
import { useDeleteTask } from "@/features/projects/hooks/use-tasks";
import { collectItemPaths } from "@/features/projects/utils/work-item-path";
import { tipoStyle, type TipoStyle } from "@/features/projects/utils/tipo-style";
import type { WorkItemTree } from "@/features/projects/types/api.types";
import { buildTeamBoard, type BoardColumn } from "@/features/projects/utils/team-board";
import { ReassignTaskButton } from "@/features/projects/components/teams/ReassignTaskButton";
import { TraceabilityPanel } from "@/features/projects/components/detail/TraceabilityPanel";
import { useTeamTasks, useWorkspaceAccess } from "../hooks/use-workspace";
import { EditTeamTaskModal } from "./EditTeamTaskModal";
import { NewSubtaskModal } from "./NewSubtaskModal";
import { NewTeamTaskModal } from "./NewTeamTaskModal";
import { StartTaskButton } from "./StartTaskButton";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import type { WorkspaceMember } from "../types";
import {
  STATUS_META,
  activeBlockers,
  buildTaskRows,
  visibleRows,
  daysUntilDue,
  formatDueDate,
  groupTeamTasks,
  isOverdue,
  taskProgressPct,
  urgencyMeta,
  type TaskGrouping,
  type TaskTreeRow,
} from "../utils/team-tasks";
import { TeamTaskFilterBar } from "./TeamTaskFilterBar";
import {
  DEFAULT_TEAM_TASK_FILTERS,
  EMPTY_TEAM_TASK_FILTERS,
  UNASSIGNED,
  filterTeamTasks,
  type TeamTaskFilters,
} from "../utils/team-task-filters";

// Estructura y Cronograma viven ahora como secciones propias del menú lateral
// del espacio (WorkspaceNav), no dentro de esta vista.
type ViewMode = "lista" | "kanban" | "trazabilidad";

/** Ruta «padre › módulo › **unidad**» del elemento del que cuelga una tarea.
 *  `max` acota cuántos segmentos finales se muestran (con «…» delante); el
 *  `title` siempre lleva la ruta completa. */
function Crumb({ path, max }: { path: string[]; max?: number }) {
  if (path.length === 0) {
    return <>Sin elemento</>;
  }
  const shown = max && path.length > max ? path.slice(-max) : path;
  const clipped = shown.length < path.length;
  return (
    <span title={path.join(" › ")}>
      {clipped && <span>… › </span>}
      {shown.slice(0, -1).map((name, i) => (
        <span key={`${name}-${String(i)}`}>{name} › </span>
      ))}
      <span className="font-semibold text-slate-500 dark:text-slate-400">
        {shown[shown.length - 1]}
      </span>
    </span>
  );
}

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
  // El backend ya calcula el avance (promedio de subtareas para las tareas
  // padre); `taskProgressPct` queda como respaldo por si la respuesta es vieja.
  const pct = task.progress_pct ?? taskProgressPct(task.status);
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

/** Una tarea padre es un entregable: cuando su avance llega al 100% (todas las
 *  subtareas hechas y, si hacía falta, ya aprobada) queda lista para entregarse
 *  como tal. Las subtareas nunca son entregables. */
function isDeliverableReady(task: ApiTeamTask): boolean {
  return (
    task.parent_task_id === null &&
    (task.progress_pct ?? 0) >= 100 &&
    task.status !== "completada" &&
    task.status !== "cancelada"
  );
}

function DeliverableReadyBadge() {
  return (
    <span
      title="Todas las subtareas están hechas: esta tarea ya se puede entregar como entregable."
      className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-teal-dark dark:text-brand-teal"
    >
      <PackageCheck className="size-3" />
      Entregable listo
    </span>
  );
}

interface DeliverCbs {
  /** Abre "Nuevo entregable" precargado con esta tarea (entrega con adjunto). */
  onDeliver?: (task: ApiTeamTask) => void;
  /** Crea el entregable + una versión "sin adjunto" y lo manda a revisión. */
  onMarkDelivered?: (task: ApiTeamTask) => void;
  /** La tarea es del usuario y aún no tiene entregable: puede entregarla. */
  canDeliverTask?: (task: ApiTeamTask) => boolean;
}

/**
 * Acciones de entrega de una tarea PADRE ya al 100%: es el entregable, y su
 * responsable lo entrega aquí mismo. Reusa el flujo de la pestaña Entregables
 * (mismo modal, misma aprobación). No aparece en subtareas ni para quien no es
 * el responsable (ese solo ve el badge).
 */
function DeliverActions({ task, cbs }: { task: ApiTeamTask; cbs: DeliverCbs }) {
  if (!isDeliverableReady(task) || !(cbs.canDeliverTask?.(task) ?? false)) {
    return null;
  }
  return (
    <>
      {cbs.onDeliver && (
        <button
          type="button"
          onClick={() => {
            cbs.onDeliver?.(task);
          }}
          title="Entregar con un adjunto (crea un entregable revisable)"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold-dark transition-colors hover:bg-brand-gold/20 dark:text-brand-gold"
        >
          <UploadCloud className="size-3.5" />
          Entregar
        </button>
      )}
      {cbs.onMarkDelivered && (
        <button
          type="button"
          onClick={() => {
            cbs.onMarkDelivered?.(task);
          }}
          title="Entregar sin adjunto: crea el entregable y lo manda a revisión (o lo completa si la tarea no exige aprobación)"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Check className="size-3.5" />
          Sin adjunto
        </button>
      )}
    </>
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
/** Etiqueta "Depende de terceros": solo cuando la tarea tiene una dependencia
 * FtS hacia una «actividad de terceros». */
function ThirdPartyDepBadge({ task }: { task: ApiTeamTask }) {
  if (!task.depends_on_third_party) {
    return null;
  }
  return (
    <span
      title="Depende de una actividad de terceros"
      className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    >
      <ExternalLink className="size-2.5" /> Depende de terceros
    </span>
  );
}

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
  projectId,
  teamMembers,
  pathOf,
  color,
  hideAssignee,
  hasChildren,
  isParent,
  collapsed,
  onToggleCollapse,
  onAddSubtask,
  onReassigned,
  onEdit,
  onDelete,
  deliverCbs,
}: {
  row: TaskTreeRow;
  today: string;
  canReview: boolean;
  projectId: string;
  teamMembers: ApiTeamMember[];
  pathOf: (task: ApiTeamTask) => string[];
  /** Estilo del tipo del elemento de origen: acento de color para reconocer de
   *  qué componente viene la tarea (clave con tareas clonadas). */
  color: TipoStyle | null;
  /** La vista ya está agrupada/filtrada por persona: no repetir el nombre. */
  hideAssignee: boolean;
  /** La tarea tiene subtareas EN ESTA VISTA: chevron para ocultarlas/verlas. */
  hasChildren: boolean;
  /** La tarea es padre en el conjunto completo: sin botón «Comenzar». */
  isParent: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddSubtask: (task: ApiTeamTask) => void;
  onReassigned: () => void;
  onEdit: (task: ApiTeamTask) => void;
  onDelete: (task: ApiTeamTask) => void;
  deliverCbs: DeliverCbs;
}) {
  const { task, depth, detachedParentTitle } = row;
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border-t border-slate-100 py-2.5 pr-4 first:border-t-0 dark:border-slate-800",
        // Las subtareas se tiñen para que el bloque padre+hijas se lea como una
        // unidad aunque la indentación sea sutil.
        depth > 0 && "bg-slate-50/60 dark:bg-slate-800/20",
      )}
      // Indentación por nivel: la misma lectura que la estructura del proyecto.
      style={{ paddingLeft: `${String(1 + depth * 1.4)}rem` }}
    >
      {/* Acento de color del elemento de origen (mismo color que la Estructura
          y el cronograma): distingue las tareas de un clon de las del original. */}
      {color && (
        <span aria-hidden className={cn("absolute inset-y-1 left-0 w-1 rounded-r", color.bar)} />
      )}
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
          {hasChildren && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              title={collapsed ? "Ver subtareas" : "Ocultar subtareas"}
              className="flex shrink-0 items-center rounded text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              {collapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          )}
          <span className="truncate">{task.title}</span>
          {hasChildren && collapsed && (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              subtareas ocultas
            </span>
          )}
          {isDeliverableReady(task) && <DeliverableReadyBadge />}
        </p>
        <p className="flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {color && (
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", color.dot)} />
          )}
          <span className="truncate">
            {/* Cuando el padre cayó en otro grupo, decimos de cuál cuelga: sin
                esto la subtarea aparecería suelta y sin contexto. */}
            {detachedParentTitle !== null && (
              <span className="text-slate-400 dark:text-slate-500">
                Subtarea de «{detachedParentTitle}» ·{" "}
              </span>
            )}
            <Crumb path={pathOf(task)} /> · {task.project_name}
          </span>
        </p>
        <ThirdPartyDepBadge task={task} />
        <BlockedBy task={task} />
      </div>

      {/* Responsable. Cuando la vista ya va agrupada o filtrada por persona el
          nombre es redundante: se oculta (y para el líder queda solo el icono
          de reasignar). Si no, líder/supervisor ven el selector; el resto, el
          nombre. */}
      {hideAssignee ? (
        canReview && teamMembers.length > 0 ? (
          <span className="flex w-[150px] shrink-0 justify-start">
            <ReassignTaskButton
              compact
              projectId={projectId}
              taskId={task.id}
              currentAssigneeId={task.assignee_id}
              members={teamMembers}
              onDone={onReassigned}
            />
          </span>
        ) : null
      ) : (
        <span className="w-[150px] shrink-0">
          {canReview && teamMembers.length > 0 ? (
            <ReassignTaskButton
              projectId={projectId}
              taskId={task.id}
              currentAssigneeId={task.assignee_id}
              members={teamMembers}
              onDone={onReassigned}
            />
          ) : (
            <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
              {task.assignee_name ?? "Sin responsable"}
            </span>
          )}
        </span>
      )}

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

      {/* "Comenzar": solo el responsable, en su propia tarea sin iniciar y que
          no sea padre (las tareas padre avanzan por sus subtareas). */}
      <StartTaskButton task={task} projectId={projectId} isParent={isParent} />

      {/* "Entregar": tarea padre al 100%, solo para su responsable. */}
      <DeliverActions task={task} cbs={deliverCbs} />

      {/* Acciones del líder: partir en subtareas (solo tareas raíz), editar y
          eliminar (cualquier nivel — la tarea sigue siendo de SU equipo). */}
      {canReview ? (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-all focus-within:opacity-100 group-hover:opacity-100">
          {task.parent_task_id === null && (
            <button
              type="button"
              onClick={() => {
                onAddSubtask(task);
              }}
              title="Agregar subtarea"
              aria-label={`Agregar subtarea a ${task.title}`}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-brand-teal/10 hover:text-brand-teal-dark dark:hover:text-brand-teal"
            >
              <Plus className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onEdit(task);
            }}
            title="Editar tarea"
            aria-label={`Editar ${task.title}`}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(task);
            }}
            title="Eliminar tarea"
            aria-label={`Eliminar ${task.title}`}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
    </div>
  );
}

function ListView({
  groups,
  allTasks,
  parentIds,
  members,
  grouping,
  today,
  canReview,
  projectId,
  teamMembers,
  pathOf,
  colorOf,
  hideAssignee,
  onAddSubtask,
  onReassigned,
  onEdit,
  onDelete,
  deliverCbs,
}: {
  groups: ReturnType<typeof groupTeamTasks>;
  /** Todas las del equipo: resuelven el título de un padre fuera del grupo. */
  allTasks: ApiTeamTask[];
  /** Ids de tareas padre en el conjunto completo (para suprimir «Comenzar»). */
  parentIds: ReadonlySet<string>;
  members: WorkspaceMember[];
  grouping: TaskGrouping;
  today: string;
  canReview: boolean;
  projectId: string;
  teamMembers: ApiTeamMember[];
  pathOf: (task: ApiTeamTask) => string[];
  colorOf: (task: ApiTeamTask) => TipoStyle | null;
  hideAssignee: boolean;
  onAddSubtask: (task: ApiTeamTask) => void;
  onReassigned: () => void;
  onEdit: (task: ApiTeamTask) => void;
  onDelete: (task: ApiTeamTask) => void;
  deliverCbs: DeliverCbs;
}) {
  const childIds = useMemo(
    () => new Set(allTasks.flatMap((t) => (t.parent_task_id !== null ? [t.parent_task_id] : []))),
    [allTasks],
  );
  // Subtareas plegables por tarea padre. Por defecto TODAS colapsadas: al abrir
  // la vista se ven solo las tareas raíz y el usuario despliega lo que quiera.
  // Lazy-init a partir de las tareas presentes al montar; el estado se reinicia
  // al salir de la vista Lista, que es lo esperable.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(childIds));

  return (
    // `absolute inset-0` contra el padre `relative`: scrollea siempre, sin
    // depender de que `h-full` resuelva contra un alto definido en cadena.
    <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto p-4 sm:p-6">
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
                {visibleRows(buildTaskRows(group.tasks, allTasks), collapsed).map((row) => (
                  <TaskRow
                    key={row.task.id}
                    row={row}
                    today={today}
                    canReview={canReview}
                    projectId={projectId}
                    teamMembers={teamMembers}
                    pathOf={pathOf}
                    color={colorOf(row.task)}
                    hideAssignee={hideAssignee}
                    hasChildren={childIds.has(row.task.id)}
                    isParent={parentIds.has(row.task.id)}
                    collapsed={collapsed.has(row.task.id)}
                    onToggleCollapse={() => {
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.task.id)) {
                          next.delete(row.task.id);
                        } else {
                          next.add(row.task.id);
                        }
                        return next;
                      });
                    }}
                    onAddSubtask={onAddSubtask}
                    onReassigned={onReassigned}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    deliverCbs={deliverCbs}
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
  path,
  color,
  canReview,
  projectId,
  teamMembers,
  hideAssignee,
  onReassigned,
  onEdit,
  onDelete,
  deliverCbs,
}: {
  task: ApiTeamTask;
  /** Título del padre cuando la tarjeta es una subtarea. */
  parentTitle: string | null;
  members: WorkspaceMember[];
  today: string;
  path: string[];
  /** Estilo del tipo del elemento de origen (acento de color). */
  color: TipoStyle | null;
  canReview: boolean;
  projectId: string;
  teamMembers: ApiTeamMember[];
  hideAssignee: boolean;
  onReassigned: () => void;
  onEdit: (task: ApiTeamTask) => void;
  onDelete: (task: ApiTeamTask) => void;
  deliverCbs: DeliverCbs;
}) {
  const member = members.find((m) => m.id === task.assignee_id);
  return (
    // `shrink-0`: sin esto, en una columna con muchas tarjetas el flex las
    // aplastaba y su `overflow-hidden` recortaba el contenido (título pisando la
    // urgencia, "Comenzar" encima…). Ahora cada tarjeta conserva su alto y la
    // columna scrollea.
    <article className="group relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 pl-3.5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Acento de color del elemento de origen: de un vistazo, de qué
          componente viene la tarjeta (distingue clones del original). */}
      {color && <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", color.bar)} />}
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-200"
          title={task.title}
        >
          {task.title}
        </p>
        {/* Kanban = solo lectura: sin «Comenzar». Se arranca desde la Lista. */}
        <div className="flex shrink-0 items-center gap-1">
          <UrgencyBadge task={task} />
          {canReview && (
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  onEdit(task);
                }}
                title="Editar tarea"
                aria-label={`Editar ${task.title}`}
                className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(task);
                }}
                title="Eliminar tarea"
                aria-label={`Eliminar ${task.title}`}
                className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          )}
        </div>
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
      {/* De dónde viene: elemento › padre › padre del padre (3 niveles finales). */}
      <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
        {color && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", color.dot)} />}
        <span className="truncate">
          <Crumb path={path} max={3} />
        </span>
      </p>

      {isDeliverableReady(task) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <DeliverableReadyBadge />
          <DeliverActions task={task} cbs={deliverCbs} />
        </div>
      )}
      <ThirdPartyDepBadge task={task} />
      <BlockedBy task={task} />
      <ProgressBar task={task} className="mt-2.5" />

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {hideAssignee ? (
          <span />
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar member={member} name={task.assignee_name ?? "Sin responsable"} />
            <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
              {task.assignee_name ?? "Sin responsable"}
            </span>
          </div>
        )}
        <DueDate task={task} today={today} />
      </div>

      {canReview && teamMembers.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
          <ReassignTaskButton
            compact={hideAssignee}
            projectId={projectId}
            taskId={task.id}
            currentAssigneeId={task.assignee_id}
            members={teamMembers}
            onDone={onReassigned}
          />
        </div>
      )}
    </article>
  );
}

// Cuántas tarjetas muestra una columna del Kanban antes de pedir "ver más".
const KANBAN_PAGE = 15;

function KanbanColumn({
  col,
  titleById,
  members,
  today,
  pathOf,
  colorOf,
  canReview,
  projectId,
  teamMembers,
  hideAssignee,
  onReassigned,
  onEdit,
  onDelete,
  deliverCbs,
}: {
  col: BoardColumn<ApiTeamTask>;
  titleById: Map<string, string>;
  members: WorkspaceMember[];
  today: string;
  pathOf: (task: ApiTeamTask) => string[];
  colorOf: (task: ApiTeamTask) => TipoStyle | null;
  canReview: boolean;
  projectId: string;
  teamMembers: ApiTeamMember[];
  hideAssignee: boolean;
  onReassigned: () => void;
  onEdit: (task: ApiTeamTask) => void;
  onDelete: (task: ApiTeamTask) => void;
  deliverCbs: DeliverCbs;
}) {
  const [visible, setVisible] = useState(KANBAN_PAGE);
  const shown = col.tasks.slice(0, visible);
  const remaining = col.tasks.length - shown.length;

  return (
    <section className="flex w-[280px] shrink-0 flex-col">
      <header
        className={cn(
          "flex items-center justify-between gap-2 rounded-t-lg border px-3 py-2",
          col.atRisk
            ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
            : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50",
        )}
      >
        <p
          className={cn(
            "flex items-center gap-1 truncate text-[12px] font-semibold",
            col.atRisk ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-300",
          )}
        >
          {col.atRisk && <AlertTriangle className="size-3.5 shrink-0" />}
          {col.label}
        </p>
        <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {col.tasks.length}
        </span>
      </header>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border border-t-0 p-2",
          col.atRisk
            ? "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
            : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30",
        )}
      >
        {col.tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-slate-300 dark:text-slate-600">
            Sin tareas
          </p>
        ) : (
          <>
            {shown.map((task) => (
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
                path={pathOf(task)}
                color={colorOf(task)}
                canReview={canReview}
                projectId={projectId}
                teamMembers={teamMembers}
                hideAssignee={hideAssignee}
                onReassigned={onReassigned}
                onEdit={onEdit}
                onDelete={onDelete}
                deliverCbs={deliverCbs}
              />
            ))}
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => {
                  setVisible((n) => n + KANBAN_PAGE);
                }}
                className="shrink-0 rounded-md border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
              >
                Ver {Math.min(remaining, KANBAN_PAGE)} más
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function KanbanView({
  allTasks,
  members,
  today,
  pathOf,
  colorOf,
  canReview,
  projectId,
  teamMembers,
  hideAssignee,
  onReassigned,
  onEdit,
  onDelete,
  deliverCbs,
}: {
  allTasks: ApiTeamTask[];
  members: WorkspaceMember[];
  today: string;
  pathOf: (task: ApiTeamTask) => string[];
  colorOf: (task: ApiTeamTask) => TipoStyle | null;
  canReview: boolean;
  projectId: string;
  teamMembers: ApiTeamMember[];
  hideAssignee: boolean;
  onReassigned: () => void;
  onEdit: (task: ApiTeamTask) => void;
  onDelete: (task: ApiTeamTask) => void;
  deliverCbs: DeliverCbs;
}) {
  const titleById = new Map(allTasks.map((t) => [t.id, t.title]));
  // Columnas de estado + una lane «En riesgo» (roja) al frente con las abiertas
  // vencidas o por vencer, sacadas de su estado (misma lógica que el proyecto).
  const columns = useMemo(() => buildTeamBoard(allTasks, today), [allTasks, today]);
  return (
    // Scroll horizontal propio del tablero; `absolute inset-0` para tener alto.
    <div className="absolute inset-0 flex gap-3 overflow-x-auto p-4 sm:p-6">
      {columns.map((col) => (
        <KanbanColumn
          key={col.key}
          col={col}
          titleById={titleById}
          members={members}
          today={today}
          pathOf={pathOf}
          colorOf={colorOf}
          canReview={canReview}
          projectId={projectId}
          teamMembers={teamMembers}
          hideAssignee={hideAssignee}
          onReassigned={onReassigned}
          onEdit={onEdit}
          onDelete={onDelete}
          deliverCbs={deliverCbs}
        />
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
  /** Proyecto del equipo: el cronograma y la estructura cuelgan de él. */
  projectId: string;
  members: WorkspaceMember[];
  /** Integrantes en crudo (con `user_id`): los usa el líder para reasignar. */
  teamMembers: ApiTeamMember[];
  /** Entrega de una tarea padre al 100% (reusa el flujo de la pestaña
   *  Entregables). Sin estas props, solo se muestra el badge "Entregable listo". */
  onDeliver?: (task: ApiTeamTask) => void;
  onMarkDelivered?: (task: ApiTeamTask) => void;
  /** La tarea es del usuario y aún no tiene entregable vinculado. */
  canDeliverTask?: (task: ApiTeamTask) => boolean;
}

/**
 * Tareas reales delegadas al equipo, en Lista o Kanban y agrupadas por
 * integrante o por estado. Todo lo que se ve —avance, urgencia, fecha,
 * bloqueos— sale del modelo de tareas del proyecto: es la MISMA tarea que ven
 * el cronograma y la trazabilidad, no una copia del equipo.
 */
export function TeamTasksView({
  teamId,
  projectId,
  members,
  teamMembers,
  onDeliver,
  onMarkDelivered,
  canDeliverTask,
}: TeamTasksViewProps) {
  const deliverCbs: DeliverCbs = { onDeliver, onMarkDelivered, canDeliverTask };
  const { user } = useAuth();
  const query = useTeamTasks(teamId);
  const accessQuery = useWorkspaceAccess(teamId);
  const canReview = accessQuery.data?.can_review ?? false;
  // El líder/supervisor puede filtrar por persona; un integrante solo ve lo suyo.
  const canFilterByPerson = canReview;
  const treeQuery = useWorkTree(projectId);
  const typesQuery = useNodeTypes(projectId);
  const qc = useQueryClient();
  const deleteTask = useDeleteTask(projectId);

  const [view, setView] = useState<ViewMode>("lista");
  const [grouping, setGrouping] = useState<TaskGrouping>("integrante");
  const [subtaskParent, setSubtaskParent] = useState<ApiTeamTask | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  // Abre mostrando solo la bolsa del equipo (tareas sin asignar); los botones
  // por integrante de la barra de filtros llevan al trabajo de cada persona.
  const [filters, setFilters] = useState<TeamTaskFilters>(DEFAULT_TEAM_TASK_FILTERS);

  // Integrante (sin permiso de revisión): la vista queda fijada a SUS tareas.
  // No se sincroniza el estado —se deriva aquí—: así el efecto no dispara
  // renders en cascada y el resto del filtrado (estado, texto…) sigue vivo.
  const userId = user?.id;
  const effectiveFilters: TeamTaskFilters = useMemo(
    () => (canFilterByPerson || !userId ? filters : { ...filters, assignee: userId }),
    [filters, canFilterByPerson, userId],
  );
  // Edición/borrado de una tarea (o subtarea) del equipo, solo para el líder.
  const [editingTask, setEditingTask] = useState<ApiTeamTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<ApiTeamTask | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);
  const allTasks = useMemo(() => query.data ?? [], [query.data]);
  // Tareas que SON padre (tienen al menos una subtarea), sobre el conjunto
  // completo del equipo: una tarea padre no se "comienza" a mano, su avance
  // sale de las subtareas. Alimenta la supresión del botón «Comenzar».
  const parentIds = useMemo(
    () => new Set(allTasks.flatMap((t) => (t.parent_task_id !== null ? [t.parent_task_id] : []))),
    [allTasks],
  );

  // ── Estructura del proyecto: jerarquía + tipo de cada elemento ──────────────
  const treeData = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const pathById = useMemo(() => collectItemPaths(treeData), [treeData]);
  const pathOf = (task: ApiTeamTask): string[] =>
    task.work_item_id ? (pathById.get(task.work_item_id) ?? []) : [];

  // Tipo (nombre + flag de terceros) por `tipo_id`, para el color de origen.
  const tipoMetaById = useMemo(() => {
    const map = new Map<string, { nombre: string; esDep: boolean }>();
    (typesQuery.data ?? []).forEach((tp) => {
      map.set(tp.id, { nombre: tp.nombre, esDep: tp.es_dependencia_externa });
    });
    return map;
  }, [typesQuery.data]);

  // Por cada elemento: su `tipo_id`, sus ancestros (incluyéndose) y su ruta.
  // `ancestorsById` alimenta el filtro por rama; `elementInfo`, el color y los
  // desplegables de "Elemento" / "Rama".
  const { ancestorsById, elementInfo } = useMemo(() => {
    const ancestors = new Map<string, Set<string>>();
    const info = new Map<string, { tipoId: string; name: string }>();
    const walk = (nodes: WorkItemTree[], trail: string[]) => {
      for (const node of nodes) {
        info.set(node.id, { tipoId: node.tipo_id, name: node.nombre });
        ancestors.set(node.id, new Set([...trail, node.id]));
        walk(node.children, [...trail, node.id]);
      }
    };
    walk(treeData, []);
    return { ancestorsById: ancestors, elementInfo: info };
  }, [treeData]);

  const ancestorsOf = useCallback(
    (workItemId: string | null): ReadonlySet<string> =>
      workItemId ? (ancestorsById.get(workItemId) ?? new Set([workItemId])) : new Set(),
    [ancestorsById],
  );

  /** Estilo del tipo de un elemento de la estructura (por su id). */
  const styleForItemId = useCallback(
    (workItemId: string | null): TipoStyle | null => {
      if (!workItemId) {
        return null;
      }
      const el = elementInfo.get(workItemId);
      if (!el) {
        return null;
      }
      const meta = tipoMetaById.get(el.tipoId);
      return tipoStyle(el.tipoId, meta?.nombre, meta?.esDep);
    },
    [elementInfo, tipoMetaById],
  );

  /** Color de ORIGEN de una tarea: el estilo del tipo de su elemento padre. Deja
   *  ver de qué componente viene cada tarea aunque dos se llamen igual (clones). */
  const colorOf = useCallback(
    (task: ApiTeamTask): TipoStyle | null => styleForItemId(task.work_item_id),
    [styleForItemId],
  );

  // Opciones de los filtros por elemento y por rama, tomadas de TODAS las tareas
  // del equipo (no de las ya filtradas), para que el desplegable no se vacíe.
  const elementOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const tk of allTasks) {
      if (tk.work_item_id) {
        ids.add(tk.work_item_id);
      }
    }
    return [...ids]
      .map((id) => ({
        id,
        label: (pathById.get(id) ?? [elementInfo.get(id)?.name ?? "Elemento"]).join(" › "),
        dot: styleForItemId(id)?.dot ?? "bg-slate-400",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allTasks, pathById, elementInfo, styleForItemId]);

  const branchOptions = useMemo(() => {
    const leafIds = new Set<string>();
    for (const tk of allTasks) {
      if (tk.work_item_id) {
        leafIds.add(tk.work_item_id);
      }
    }
    // Ancestros ESTRICTOS (el "padre del padre" y más arriba) de esos elementos.
    const branchIds = new Set<string>();
    for (const leaf of leafIds) {
      for (const anc of ancestorsById.get(leaf) ?? []) {
        if (anc !== leaf) {
          branchIds.add(anc);
        }
      }
    }
    return [...branchIds]
      .map((id) => ({
        id,
        label: (pathById.get(id) ?? [elementInfo.get(id)?.name ?? "Rama"]).join(" › "),
        dot: styleForItemId(id)?.dot ?? "bg-slate-400",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allTasks, ancestorsById, pathById, elementInfo, styleForItemId]);

  // Filtramos ANTES de agrupar: Lista, Kanban y Estructura ven el mismo
  // subconjunto. El cronograma y la trazabilidad tienen sus propios filtros.
  const tasks = useMemo(
    () => filterTeamTasks(allTasks, effectiveFilters, ancestorsOf),
    [allTasks, effectiveFilters, ancestorsOf],
  );
  const patchFilters = (patch: Partial<TeamTaskFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  };
  const showFilterBar = view === "lista" || view === "kanban";
  const onReassigned = () =>
    void qc.invalidateQueries({ queryKey: ["workspace", "tasks", teamId] });
  // En Kanban la agrupación por estado ES el tablero; agrupar por integrante
  // dentro de columnas de estado no tendría dónde ir.
  const effectiveGrouping: TaskGrouping =
    view === "lista" && canFilterByPerson ? grouping : "estado";
  // El nombre del responsable sobra cuando la vista ya está acotada a una
  // persona: agrupada por integrante, o filtrada a un responsable concreto.
  const hideAssignee =
    effectiveGrouping === "integrante" ||
    (effectiveFilters.assignee !== "all" && effectiveFilters.assignee !== UNASSIGNED);
  // Vista recién abierta en la bolsa del equipo (solo «sin asignar») y esa
  // bolsa está vacía: no dejamos la pantalla en blanco, invitamos a filtrar.
  const emptyBag =
    tasks.length === 0 &&
    allTasks.length > 0 &&
    effectiveFilters.assignee === UNASSIGNED &&
    effectiveFilters.status === "all" &&
    effectiveFilters.text.trim() === "" &&
    !effectiveFilters.onlyBlocked &&
    effectiveFilters.elementId === "all" &&
    effectiveFilters.branchId === "all";
  // Integrante sin ninguna tarea propia en el equipo: la bolsa de arriba es de
  // líder, así que le damos su propio vacío.
  const emptyForMember =
    !canFilterByPerson &&
    tasks.length === 0 &&
    allTasks.length > 0 &&
    effectiveFilters.status === "all" &&
    effectiveFilters.text.trim() === "" &&
    !effectiveFilters.onlyBlocked &&
    effectiveFilters.elementId === "all" &&
    effectiveFilters.branchId === "all";
  const groups = useMemo(
    () => groupTeamTasks(tasks, effectiveGrouping),
    [tasks, effectiveGrouping],
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
  if (allTasks.length === 0) {
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
            // La trazabilidad del equipo solo para quien lo lidera / supervisa.
            ...(canReview
              ? [{ value: "trazabilidad" as const, label: "Trazabilidad", Icon: History }]
              : []),
          ]}
        />

        {/* Agrupar por integrante solo tiene sentido para quien coordina; un
            integrante solo se ve a sí mismo. */}
        {view === "lista" && canFilterByPerson && (
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

        {!showFilterBar && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {allTasks.length} tarea{allTasks.length === 1 ? "" : "s"}
          </span>
        )}

        {canReview && (
          <button
            type="button"
            onClick={() => {
              setShowNewTask(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
          >
            <Plus className="size-3.5" />
            Nueva tarea
          </button>
        )}
      </div>

      {showFilterBar && (
        <TeamTaskFilterBar
          filters={effectiveFilters}
          onChange={patchFilters}
          onReset={() => {
            // Para el integrante, `effectiveFilters` vuelve a fijar el responsable
            // a lo suyo, así que basta con vaciar el estado crudo.
            setFilters(EMPTY_TEAM_TASK_FILTERS);
          }}
          canFilterByPerson={canFilterByPerson}
          teamMembers={teamMembers}
          elementOptions={elementOptions}
          branchOptions={branchOptions}
          shown={tasks.length}
          totalTasks={allTasks.length}
        />
      )}

      {/* `relative` + hijos `absolute inset-0`: el scroll interno funciona sin
          depender de que `h-full` en cadena resuelva contra un alto definido. */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {showFilterBar && emptyBag && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Filter className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No hay tareas sin asignar
                </p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                  Todo el trabajo de este equipo ya está repartido. Usa los filtros de arriba —por
                  integrante o por estado— para ver las tareas en curso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_TEAM_TASK_FILTERS);
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
              >
                Ver todas las tareas
              </button>
            </div>
          </div>
        )}
        {emptyForMember && !emptyBag && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <EmptyState
              icon={FolderKanban}
              title="No tienes tareas en este equipo"
              hint="Cuando el líder te asigne una tarea de este equipo, aparecerá aquí."
            />
          </div>
        )}
        {view === "lista" && !emptyBag && !emptyForMember && (
          <ListView
            groups={groups}
            allTasks={tasks}
            parentIds={parentIds}
            members={members}
            grouping={effectiveGrouping}
            today={today}
            canReview={canReview}
            projectId={projectId}
            teamMembers={teamMembers}
            pathOf={pathOf}
            colorOf={colorOf}
            hideAssignee={hideAssignee}
            onAddSubtask={setSubtaskParent}
            onReassigned={onReassigned}
            onEdit={setEditingTask}
            onDelete={(task) => {
              setDeleteError(null);
              setDeletingTask(task);
            }}
            deliverCbs={deliverCbs}
          />
        )}
        {view === "kanban" && !emptyBag && !emptyForMember && (
          <KanbanView
            allTasks={tasks}
            members={members}
            today={today}
            pathOf={pathOf}
            colorOf={colorOf}
            canReview={canReview}
            projectId={projectId}
            teamMembers={teamMembers}
            hideAssignee={hideAssignee}
            onReassigned={onReassigned}
            onEdit={setEditingTask}
            onDelete={(task) => {
              setDeleteError(null);
              setDeletingTask(task);
            }}
            deliverCbs={deliverCbs}
          />
        )}
        {view === "trazabilidad" && (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <TraceabilityPanel projectId={projectId} lockedTeamId={teamId} />
          </div>
        )}
      </div>

      {subtaskParent && (
        <NewSubtaskModal
          teamId={teamId}
          parent={subtaskParent}
          siblings={allTasks.filter((t) => t.parent_task_id === subtaskParent.id)}
          onClose={() => {
            setSubtaskParent(null);
          }}
        />
      )}

      {showNewTask && (
        <NewTeamTaskModal
          teamId={teamId}
          projectId={projectId}
          onClose={() => {
            setShowNewTask(false);
          }}
        />
      )}

      {editingTask && (
        <EditTeamTaskModal
          projectId={projectId}
          task={editingTask}
          teamMembers={teamMembers}
          siblings={
            editingTask.parent_task_id === null
              ? []
              : allTasks.filter(
                  (t) => t.parent_task_id === editingTask.parent_task_id && t.id !== editingTask.id,
                )
          }
          onClose={() => {
            setEditingTask(null);
          }}
        />
      )}

      {deletingTask && (
        <ConfirmDialog
          destructive
          title="Eliminar tarea"
          message={`¿Eliminar "${deletingTask.title}"? Si tiene subtareas, también se eliminan.`}
          confirmLabel="Eliminar"
          loading={deleteTask.isPending}
          errorMessage={deleteError}
          onConfirm={() => {
            deleteTask.mutate(deletingTask.id, {
              onSuccess: () => {
                setDeletingTask(null);
                setDeleteError(null);
              },
              onError: (error) => {
                setDeleteError(getErrorMessage(error, "No se pudo eliminar la tarea"));
              },
            });
          }}
          onCancel={() => {
            setDeletingTask(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
