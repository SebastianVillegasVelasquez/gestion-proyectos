import { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  CornerDownRight,
  ExternalLink,
  GripVertical,
  Trash2,
  User,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import { TaskDurationBadge } from "../TaskDurationBadge";
import { initialsOf, resolveAssignment } from "../../utils/task-assignment";
import { formatDateRange, isOverdue } from "../../utils/task-dates";
import {
  dropAfterId,
  moveDownAfterId,
  moveUpAfterId,
  siblingsOf,
  type TaskNode,
} from "../../utils/task-order";
import type { ProjectMember, Task, Team } from "../../types/api.types";

export interface TaskRowCallbacks {
  onOpen: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Recoloca `task` entre sus hermanas: `afterId` = tras quién queda; `null` =
   * primera. No se llama si el movimiento no cambia nada. */
  onReorder: (task: Task, afterId: string | null) => void;
}

interface StructureTaskTreeProps extends TaskRowCallbacks {
  nodes: TaskNode<Task>[];
  /** Todas las tareas del elemento: se usa para calcular las hermanas al
   * reordenar (mismo `work_item_id` y `parent_task_id`). */
  allTasks: Task[];
  memberById: Map<string, ProjectMember>;
  teamById: Map<string, Team>;
  /** El elemento del que cuelgan estas tareas es una «actividad de terceros»:
   * el responsable del trabajo es el tercero, no un integrante ni un equipo. */
  isThirdParty?: boolean;
  depth?: number;
}

/**
 * Las tareas de un elemento dentro del árbol de la estructura, con sus
 * subtareas anidadas.
 *
 * Una tarea se ve distinta de un elemento (chip «tarea» dorado); una subtarea
 * se distingue además con el chip «subtarea» y una sangría propia. El orden
 * entre hermanas se cambia con las flechas ↑/↓ o arrastrando la fila (solo
 * reordena; no cambia de madre ni de elemento).
 */
export function StructureTaskTree({
  nodes,
  allTasks,
  memberById,
  teamById,
  isThirdParty = false,
  depth = 0,
  onOpen,
  onDelete,
  onReorder,
}: StructureTaskTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <StructureTaskRow
          key={node.task.id}
          node={node}
          depth={depth}
          allTasks={allTasks}
          memberById={memberById}
          teamById={teamById}
          isThirdParty={isThirdParty}
          onOpen={onOpen}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      ))}
    </>
  );
}

function StructureTaskRow({
  node,
  depth,
  allTasks,
  memberById,
  teamById,
  isThirdParty = false,
  onOpen,
  onDelete,
  onReorder,
}: {
  node: TaskNode<Task>;
  depth: number;
  allTasks: Task[];
  memberById: Map<string, ProjectMember>;
  teamById: Map<string, Team>;
  isThirdParty?: boolean;
} & TaskRowCallbacks) {
  const { task, children } = node;
  const { person, assigneeName, team, kind } = resolveAssignment(task, memberById, teamById);
  const late = isOverdue(task);
  const done = task.status === "completada";
  const isSubtask = Boolean(task.parent_task_id);
  const hasSubtasks = children.length > 0;
  // Las subtareas se ocultan por defecto: son un detalle que no siempre
  // interesa al recorrer la estructura. El chevron las despliega.
  const [showSubtasks, setShowSubtasks] = useState(false);

  const siblings = siblingsOf(task, allTasks);
  const upAfter = moveUpAfterId(task, siblings);
  const downAfter = moveDownAfterId(task, siblings);
  const canMoveUp = upAfter !== undefined;
  const canMoveDown = downAfter !== undefined;

  return (
    <div className="relative">
      <div
        className={cn(
          "group/row relative flex items-center",
          "before:absolute before:left-[-16px] before:top-[20px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']",
        )}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.setData("application/x-task-reorder", task.id);
        }}
        onDragOver={(e) => {
          const draggedId = e.dataTransfer.getData("application/x-task-reorder");
          // Solo reordena entre hermanas: si lo que se arrastra no es una tarea
          // de este mismo grupo, no interceptamos el evento.
          if (!siblings.some((s) => s.id === draggedId) || draggedId === task.id) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.dataset.dropPos =
            e.clientY - e.currentTarget.getBoundingClientRect().top <
            e.currentTarget.getBoundingClientRect().height / 2
              ? "before"
              : "after";
        }}
        onDrop={(e) => {
          const draggedId = e.dataTransfer.getData("application/x-task-reorder");
          const dragged = siblings.find((s) => s.id === draggedId);
          if (!dragged) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const pos = e.currentTarget.dataset.dropPos === "before" ? "before" : "after";
          const afterId = dropAfterId(dragged, task, pos, siblings);
          if (afterId !== undefined) {
            onReorder(dragged, afterId);
          }
        }}
      >
        {/* Flechas para subir/bajar la prioridad. Además del arrastre: con
            muchas tareas es más preciso, y no depende de acertar la zona. */}
        <span className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover/row:opacity-100">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => {
              if (upAfter !== undefined) {
                onReorder(task, upAfter);
              }
            }}
            title="Subir en la prioridad"
            aria-label={`Subir ${task.title} en la prioridad`}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => {
              if (downAfter !== undefined) {
                onReorder(task, downAfter);
              }
            }}
            title="Bajar en la prioridad"
            aria-label={`Bajar ${task.title} en la prioridad`}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronDown className="size-3" />
          </button>
        </span>

        <GripVertical
          className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover/row:opacity-100"
          aria-hidden
        />

        {/* Desplegable de subtareas: ocultas por defecto, "opcional verlas". */}
        {hasSubtasks ? (
          <button
            type="button"
            onClick={() => {
              setShowSubtasks((v) => !v);
            }}
            aria-expanded={showSubtasks}
            title={
              showSubtasks
                ? "Ocultar subtareas"
                : `Ver ${String(children.length)} subtarea${children.length === 1 ? "" : "s"}`
            }
            className="flex shrink-0 items-center gap-0.5 rounded px-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showSubtasks ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span className="text-[10px] font-bold tabular-nums">{children.length}</span>
          </button>
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => {
            onOpen(task);
          }}
          title={`Ver la ficha de «${task.title}»`}
          className="group flex w-full min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pr-4 text-left transition-colors hover:bg-accent/40"
        >
          <span className="size-2 shrink-0 rounded-full bg-brand-gold" />
          {isSubtask ? (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-gold/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark ring-1 ring-inset ring-brand-gold/40 dark:text-brand-gold">
              <CornerDownRight className="size-2.5" /> subtarea
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
              <ClipboardList className="size-2.5" /> tarea
            </span>
          )}

          <span
            className={cn(
              "truncate text-[14px] font-medium text-foreground/85",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>

          {task.depends_on_third_party && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              title="Depende de una actividad de terceros"
            >
              <ExternalLink className="size-2.5" />
              Depende de terceros
            </span>
          )}

          {isThirdParty ? (
            /* El elemento es una «actividad de terceros»: el responsable es el
               proveedor externo, no un integrante ni un equipo. */
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              title="Responsable externo (actividad de terceros)"
            >
              <ExternalLink className="size-2.5" />
              Responsable externo
            </span>
          ) : (
            <>
              {assigneeName && (
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-brand-teal-dark dark:text-brand-teal"
                  title={`Responsable: ${assigneeName}`}
                >
                  {person ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-brand-teal/25 text-[8px] font-bold">
                      {initialsOf(person)}
                    </span>
                  ) : (
                    <User className="ml-0.5 size-2.5" />
                  )}
                  <span className="max-w-[120px] truncate">{assigneeName}</span>
                  {/* Persona sin equipo: es una tarea individual suya. */}
                  {kind === "person" && <span className="opacity-70">· individual</span>}
                </span>
              )}
              {team && (
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                  title={
                    kind === "member"
                      ? `Asignada a ${assigneeName ?? "un integrante"} del equipo ${team.name}`
                      : `Bolsa del equipo ${team.name} (el líder reparte)`
                  }
                >
                  <UsersRound className="size-2.5" />
                  <span className="max-w-[120px] truncate">{team.name}</span>
                </span>
              )}
              {!assigneeName && !team && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <User className="size-2.5" /> Sin asignar
                </span>
              )}
            </>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-3">
            <TaskDurationBadge days={task.estimated_days} />
            <span
              className={cn(
                "hidden items-center gap-1 text-[11px] tabular-nums sm:flex",
                late ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground",
              )}
            >
              {late ? <AlertTriangle className="size-3" /> : <CalendarRange className="size-3" />}
              {formatDateRange(task.start_date, task.due_date)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                TASK_STATUS_COLORS[task.status],
              )}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </span>
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
            title={`Eliminar la tarea «${task.title}»`}
            aria-label={`Eliminar la tarea ${task.title}`}
            className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-600 focus-visible:opacity-100 group-hover/row:opacity-100 dark:hover:text-rose-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {hasSubtasks && showSubtasks && (
        <div className="ml-[24px] border-l-[1.5px] border-border/70 pl-4">
          <StructureTaskTree
            nodes={children}
            depth={depth + 1}
            allTasks={allTasks}
            memberById={memberById}
            teamById={teamById}
            onOpen={onOpen}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        </div>
      )}
    </div>
  );
}
