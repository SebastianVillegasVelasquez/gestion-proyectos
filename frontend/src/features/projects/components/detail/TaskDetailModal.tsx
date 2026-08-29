import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ClipboardList,
  Clock,
  FolderTree,
  Link2,
  Pencil,
  Timer,
  User,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskEditForm } from "../../gantt/components/TaskEditForm";
import { useProjectTasks } from "../../hooks/use-tasks";
import { useTeamMembers } from "../../hooks/use-teams";
import { TaskDependencyEditor } from "../TaskDependencyEditor";
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TEAM_ROLE_ACCENT,
  TEAM_ROLE_LABELS,
  positionLabel,
} from "../../types/labels";
import { colorForName } from "../../utils/entity-color";
import { fullName, initialsOf, resolveAssignment } from "../../utils/task-assignment";
import { formatDateRange, isOverdue } from "../../utils/task-dates";
import { TaskAssigneeSelect } from "../teams/TaskAssigneeSelect";
import type { ProjectMember, Task, Team, TeamMember } from "../../types/api.types";

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Ficha del equipo responsable: sus integrantes con el rol de cada uno.
 * Solo se pide al backend cuando la tarea tiene equipo, por eso vive en su
 * propio componente (un hook no se puede llamar condicionalmente). */
function TeamBlock({
  projectId,
  team,
  highlightUserId,
}: {
  projectId: string;
  team: Team;
  highlightUserId: string | null;
}) {
  const membersQuery = useTeamMembers(projectId, team.id);
  const members = membersQuery.data ?? [];

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            colorForName(team.name),
          )}
        >
          <UsersRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{team.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {team.member_count} {team.member_count === 1 ? "integrante" : "integrantes"}
          </p>
        </div>
      </div>

      {members.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5">
          {members.map((m) => (
            <li
              key={m.user_id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                // Si la tarea además tiene un responsable concreto, se marca
                // cuál de los integrantes es: es la pregunta que se hace quien
                // abre la ficha ("¿a quién le pregunto por esto?").
                m.user_id === highlightUserId && "bg-brand-teal/10 ring-1 ring-brand-teal/30",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  TEAM_ROLE_ACCENT[m.team_role],
                )}
              >
                {initialsOf(m)}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{fullName(m)}</span>
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                {positionLabel(m.position)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  TEAM_ROLE_ACCENT[m.team_role],
                )}
              >
                {TEAM_ROLE_LABELS[m.team_role]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Ficha de una tarea vista desde la estructura del proyecto: de qué elemento
 * cuelga, en qué fechas va y quién responde (la persona, el equipo, o ambos).
 *
 * El botón «Editar» abre el mismo formulario que la vista de Tareas
 * (`TaskEditForm`): reutilizarlo evita mantener dos formularios en sincronía y,
 * como su mutación invalida las vistas de tareas, el cambio se refleja al
 * instante en la lista de Tareas y en el Cronograma.
 */
export function TaskDetailModal({
  projectId,
  task,
  containerName,
  memberById,
  teamById,
  assignableMembers,
  onClose,
}: {
  projectId: string;
  task: Task;
  /** Elemento de la estructura del que cuelga la tarea (null si está suelta). */
  containerName: string | null;
  memberById: Map<string, ProjectMember>;
  teamById: Map<string, Team>;
  /** Integrantes a los que el líder puede reasignar esta tarea. Si llega, se
   * muestra el selector rápido de responsable (sin abrir el formulario de
   * edición completo, que es de administración). */
  assignableMembers?: TeamMember[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const projectTasks = useProjectTasks(projectId);
  const assignment = useMemo(
    () => resolveAssignment(task, memberById, teamById),
    [task, memberById, teamById],
  );
  const members = useMemo(() => [...memberById.values()], [memberById]);
  const teams = useMemo(() => [...teamById.values()], [teamById]);
  const { person, team } = assignment;
  const late = isOverdue(task);
  const logged = Number(task.logged_hours);
  const estimated = task.estimated_hours != null ? Number(task.estimated_hours) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-gold/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
              <ClipboardList className="size-3" /> Tarea
            </span>
            <h3 className="mt-1.5 text-base font-semibold text-foreground">{task.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
              >
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {editing ? (
            <TaskEditForm
              projectId={projectId}
              task={task}
              members={members}
              teams={teams}
              onDone={() => {
                setEditing(false);
              }}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    TASK_STATUS_COLORS[task.status],
                  )}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    TASK_PRIORITY_COLORS[task.priority],
                  )}
                >
                  Prioridad {TASK_PRIORITY_LABELS[task.priority].toLowerCase()}
                </span>
                {late && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                    <AlertTriangle className="size-3" /> Fuera de plazo
                  </span>
                )}
              </div>

              {task.description && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {task.description}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field icon={CalendarRange} label="Lapso">
                  {formatDateRange(task.start_date, task.due_date)}
                </Field>
                <Field icon={FolderTree} label="Dentro de">
                  {containerName ?? (
                    <span className="italic text-muted-foreground">
                      Sin elemento (tarea suelta del proyecto)
                    </span>
                  )}
                </Field>
                <Field icon={Timer} label="Estimado">
                  {estimated != null ? (
                    `${estimated} h`
                  ) : (
                    <span className="text-muted-foreground">Sin estimar</span>
                  )}
                </Field>
                <Field icon={Clock} label="Dedicado">
                  {logged > 0 ? (
                    `${logged} h`
                  ) : (
                    <span className="text-muted-foreground">Sin apuntes</span>
                  )}
                </Field>
              </div>

              <Field icon={Link2} label="Dependencia">
                <TaskDependencyEditor
                  taskId={task.id}
                  projectId={projectId}
                  canEdit
                  allTasks={projectTasks.data ?? []}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Mientras la tarea de la que depende no esté completada, esta no puede avanzar de
                  estado.
                </p>
              </Field>

              <Field icon={User} label="Responsable">
                {person ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-xs font-bold text-brand-teal-dark dark:text-brand-teal">
                      {initialsOf(person)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {fullName(person)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {positionLabel(person.position)} · {person.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="italic text-muted-foreground">
                    {team
                      ? "Delegada al equipo, todavía sin responsable individual."
                      : assignment.label}
                  </p>
                )}
                {assignableMembers && assignableMembers.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Reasignar a un integrante del equipo:
                    </p>
                    <TaskAssigneeSelect
                      projectId={projectId}
                      taskId={task.id}
                      currentAssigneeId={task.assignee_id}
                      members={assignableMembers}
                    />
                  </div>
                )}
              </Field>

              {team && (
                <Field icon={UsersRound} label="Equipo asignado">
                  <TeamBlock
                    projectId={projectId}
                    team={team}
                    highlightUserId={person?.user_id ?? null}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
