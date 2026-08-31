import {
  AlertTriangle,
  CalendarRange,
  ClipboardList,
  Trash2,
  User,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import { fullName, initialsOf, resolveAssignment } from "../../utils/task-assignment";
import { formatDateRange, isOverdue } from "../../utils/task-dates";
import type { ProjectMember, Task, Team } from "../../types/api.types";

/**
 * Una tarea dentro del árbol de la estructura, como un elemento más.
 *
 * Se ve deliberadamente distinta de un elemento (chip «tarea» dorado, sin
 * flecha de plegado y sin arrastre): una tarea es una hoja del árbol, no un
 * contenedor, y no se recoloca arrastrándola — se adjunta a otro elemento
 * desde la ficha de tareas del elemento.
 */
export function StructureTaskRow({
  task,
  memberById,
  teamById,
  onOpen,
  onDelete,
}: {
  task: Task;
  memberById: Map<string, ProjectMember>;
  teamById: Map<string, Team>;
  onOpen: () => void;
  /** Si se pasa, aparece un botón de eliminar la tarea al pasar el ratón. */
  onDelete?: () => void;
}) {
  const { person, team, label } = resolveAssignment(task, memberById, teamById);
  const late = isOverdue(task);
  const done = task.status === "completada";

  return (
    <div
      className={cn(
        "group/row relative flex items-center",
        "before:absolute before:left-[-16px] before:top-[20px] before:h-[1.5px] before:w-4 before:bg-border before:content-['']",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        title={`Ver la ficha de «${task.title}»`}
        className="group flex w-full min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-2 pr-4 text-left transition-colors hover:bg-accent/40"
      >
        {/* Hueco del chevron: alinea el título con el de los elementos hermanos. */}
        <span className="size-5 shrink-0" aria-hidden />
        <span className="size-2 shrink-0 rounded-full bg-brand-gold" />
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-brand-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
          <ClipboardList className="size-2.5" /> tarea
        </span>

        <span
          className={cn(
            "truncate text-[14px] font-medium text-foreground/85",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>

        {/* Quién responde: la persona, el equipo, o los dos. Es el dato que más
            se busca al recorrer la estructura, así que va junto al nombre. */}
        {person && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-brand-teal-dark dark:text-brand-teal"
            title={`Responsable: ${fullName(person)}`}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-brand-teal/25 text-[8px] font-bold">
              {initialsOf(person)}
            </span>
            <span className="max-w-[120px] truncate">{fullName(person)}</span>
          </span>
        )}
        {team && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            title={`Equipo asignado: ${team.name}`}
          >
            <UsersRound className="size-2.5" />
            <span className="max-w-[120px] truncate">{team.name}</span>
          </span>
        )}
        {!person && !team && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <User className="size-2.5" /> {label}
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-3">
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
            onDelete();
          }}
          title={`Eliminar la tarea «${task.title}»`}
          aria-label={`Eliminar la tarea ${task.title}`}
          className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-600 focus-visible:opacity-100 group-hover/row:opacity-100 dark:hover:text-rose-400"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
