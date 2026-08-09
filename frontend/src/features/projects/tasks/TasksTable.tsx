import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Replace, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../types/labels";
import type { ProjectMember, Task, TaskPriority, TaskStatus, Team } from "../types/api.types";
import { useChangeTaskStatus, useUpdateTask } from "../hooks/use-tasks";
import { commonPrefix, replaceInTitle } from "./bulk-title";
import { AssignTaskModal } from "./AssignTaskModal";

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [, m, d] = iso.split("-");
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d} ${months[Number(m) - 1]}`;
}

// Los selects inline comparten el mismo tratamiento visual que los inputs de
// texto (borde, fondo, foco dorado). `appearance-none` quita la flecha nativa
// para dibujar una propia y que se vean idénticos en todos los navegadores.
const cellSelect =
  "w-full appearance-none rounded-md border border-border bg-card px-2 py-1 pr-6 text-xs text-foreground outline-none transition hover:border-brand-gold/60 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/** Select inline con la flecha personalizada, para igualar el estilo de los inputs. */
function CellSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        aria-label={ariaLabel}
        className={cellSelect}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/**
 * Vista de tareas como tabla editable: cada fila permite cambiar estado, prioridad
 * y reasignar (persona o equipo, excluyente) sin abrir un panel. Además, con la
 * selección por casillas, ofrece edición MASIVA de títulos: detecta el fragmento
 * común (p. ej. "C1 - ") y lo reemplaza en todas las tareas elegidas de una vez.
 */
export function TasksTable({
  projectId,
  tasks,
  members,
  teams,
  locationById,
  onOpenDetail,
}: {
  projectId: string;
  tasks: Task[];
  members: ProjectMember[];
  teams: Team[];
  locationById: Map<string, { name: string; tipoId: string }>;
  onOpenDetail: (taskId: string) => void;
}) {
  const changeStatus = useChangeTaskStatus(projectId);
  const updateTask = useUpdateTask(projectId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [dirtyFind, setDirtyFind] = useState(false);
  // Tarea que se está asignando por primera vez desde la tabla (modal).
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);

  // Nombres para mostrar la asignación actual (solo lectura en la tabla).
  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, `${m.name} ${m.last_name}`));
    return map;
  }, [members]);
  const teamName = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teams]);

  const selectedTasks = useMemo(() => tasks.filter((t) => selected.has(t.id)), [tasks, selected]);

  // Prefijo común de lo seleccionado: se propone como "buscar" hasta que el
  // usuario lo edite a mano (dirtyFind).
  const detectedPrefix = useMemo(
    () => commonPrefix(selectedTasks.map((t) => t.title)),
    [selectedTasks],
  );
  const effectiveFind = dirtyFind ? find : detectedPrefix;

  const allChecked = tasks.length > 0 && selected.size === tasks.length;

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(tasks.map((t) => t.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // La asignación es de solo lectura en la tabla: si ya tiene responsable, se
  // muestra como etiqueta y se reasigna desde la edición de la tarea; si no,
  // se ofrece asignar mediante el modal (mismo flujo que crear tarea).
  const assignmentOf = (task: Task): { kind: "person" | "team"; label: string } | null => {
    if (task.assignee_id) {
      return { kind: "person", label: memberName.get(task.assignee_id) ?? "Responsable" };
    }
    if (task.team_id) {
      return { kind: "team", label: teamName.get(task.team_id) ?? "Equipo" };
    }
    return null;
  };

  const applyBulkRename = () => {
    if (!effectiveFind) {
      return;
    }
    for (const task of selectedTasks) {
      const nextTitle = replaceInTitle(task.title, effectiveFind, replace);
      if (nextTitle !== task.title && nextTitle.trim().length >= 2) {
        updateTask.mutate({ taskId: task.id, payload: { title: nextTitle } });
      }
    }
    setSelected(new Set());
    setFind("");
    setReplace("");
    setDirtyFind(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Barra de edición masiva: aparece al seleccionar tareas. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border border-b-0 border-border bg-accent/40 px-3 py-2 text-xs">
          <span className="font-semibold text-foreground">
            {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Replace className="size-3.5" /> Reemplazar en el título:
          </span>
          <input
            value={effectiveFind}
            onChange={(e) => {
              setDirtyFind(true);
              setFind(e.target.value);
            }}
            placeholder="buscar (ej. C1 - )"
            aria-label="Texto a buscar en el título"
            className="w-32 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
          />
          <span className="text-muted-foreground">→</span>
          <input
            value={replace}
            onChange={(e) => {
              setReplace(e.target.value);
            }}
            placeholder="reemplazo (ej. C2 - )"
            aria-label="Texto de reemplazo"
            className="w-32 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
          />
          <button
            type="button"
            onClick={applyBulkRename}
            disabled={!effectiveFind || updateTask.isPending}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-50"
          >
            Aplicar a {selected.size}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
            }}
            aria-label="Quitar selección"
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" /> Limpiar
          </button>
        </div>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto border border-border bg-card",
          selected.size > 0 ? "rounded-b-2xl" : "rounded-2xl",
        )}
      >
        <table className="w-full table-fixed text-left text-sm">
          {/* Layout fijo: los anchos por columna evitan que un título largo
              empuje y aplaste al resto (estado, prioridad…). La columna "Tarea"
              es la única flexible y absorbe el espacio sobrante. */}
          <colgroup>
            <col className="w-11" />
            <col />
            <col className="w-[7.5rem]" />
            <col className="w-28" />
            <col className="w-44" />
            <col className="w-32" />
            <col className="w-20" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Seleccionar todas"
                  className="size-4 accent-brand-gold"
                />
              </th>
              <th className="px-3 py-3">Tarea</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Prioridad</th>
              <th className="px-3 py-3">Asignación</th>
              <th className="px-3 py-3">Ubicación</th>
              <th className="px-3 py-3">Vence</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const location = task.work_item_id ? locationById.get(task.work_item_id) : undefined;
              const isSel = selected.has(task.id);
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b border-accent/60 transition-colors last:border-0 hover:bg-accent/30",
                    isSel && "bg-brand-gold/5",
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => {
                        toggleOne(task.id);
                      }}
                      aria-label={`Seleccionar ${task.title}`}
                      className="size-4 accent-brand-gold"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDetail(task.id);
                      }}
                      title={task.title}
                      className="group flex w-full min-w-0 items-center gap-1.5 text-left font-semibold text-foreground hover:text-brand-gold-dark dark:hover:text-brand-gold"
                    >
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <CellSelect
                      value={task.status}
                      onChange={(value) => {
                        changeStatus.mutate({ taskId: task.id, status: value as TaskStatus });
                      }}
                      ariaLabel="Estado"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </CellSelect>
                  </td>
                  <td className="px-3 py-2">
                    <CellSelect
                      value={task.priority}
                      onChange={(value) => {
                        updateTask.mutate({
                          taskId: task.id,
                          payload: { priority: value as TaskPriority },
                        });
                      }}
                      ariaLabel="Prioridad"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </CellSelect>
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const assignment = assignmentOf(task);
                      if (!assignment) {
                        // Sin responsable: asignar por primera vez con el modal.
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningTask(task);
                            }}
                            className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:border-brand-gold hover:text-brand-gold-dark dark:hover:text-brand-gold"
                          >
                            <UserPlus className="size-3.5 shrink-0" /> Asignar
                          </button>
                        );
                      }
                      // Ya asignada: solo lectura. Se reasigna desde la edición.
                      const isTeam = assignment.kind === "team";
                      return (
                        <span
                          title={`${assignment.label} · reasigna desde la edición de la tarea`}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                            isTeam
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                              : "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
                          )}
                        >
                          {isTeam ? (
                            <Users className="size-3.5 shrink-0" />
                          ) : (
                            <UserPlus className="size-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{assignment.label}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <span className="block truncate" title={location?.name ?? undefined}>
                      {location?.name ?? "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(task.due_date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <p className="px-4 py-8 text-center text-sm italic text-muted-foreground">
            Sin tareas que coincidan.
          </p>
        )}
      </div>

      {assigningTask && (
        <AssignTaskModal
          projectId={projectId}
          task={assigningTask}
          members={members}
          teams={teams}
          onClose={() => {
            setAssigningTask(null);
          }}
        />
      )}
    </div>
  );
}
