import { useMemo, useState } from "react";
import { Pencil, Replace, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../types/labels";
import type { ProjectMember, Task, TaskPriority, TaskStatus, Team } from "../types/api.types";
import { useChangeTaskStatus, useUpdateTask } from "../hooks/use-tasks";
import { commonPrefix, replaceInTitle } from "./bulk-title";

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

const cellSelect =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-foreground outline-none transition hover:border-border focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

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

  const assignmentValue = (task: Task): string =>
    task.assignee_id ? `u:${task.assignee_id}` : task.team_id ? `t:${task.team_id}` : "";

  const reassign = (task: Task, value: string) => {
    if (value.startsWith("u:")) {
      updateTask.mutate({
        taskId: task.id,
        payload: { assignee_id: value.slice(2), team_id: null },
      });
    } else if (value.startsWith("t:")) {
      updateTask.mutate({
        taskId: task.id,
        payload: { team_id: value.slice(2), assignee_id: null },
      });
    } else {
      updateTask.mutate({ taskId: task.id, payload: { assignee_id: null, team_id: null } });
    }
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
        <table className="w-full text-left text-sm">
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
                  <td className="max-w-xs px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDetail(task.id);
                      }}
                      title="Abrir y editar la tarea"
                      className="group flex items-center gap-1.5 text-left font-semibold text-foreground hover:text-brand-gold-dark dark:hover:text-brand-gold"
                    >
                      <span className="truncate">{task.title}</span>
                      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={task.status}
                      onChange={(e) => {
                        changeStatus.mutate({
                          taskId: task.id,
                          status: e.target.value as TaskStatus,
                        });
                      }}
                      aria-label="Estado"
                      className={cellSelect}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={task.priority}
                      onChange={(e) => {
                        updateTask.mutate({
                          taskId: task.id,
                          payload: { priority: e.target.value as TaskPriority },
                        });
                      }}
                      aria-label="Prioridad"
                      className={cellSelect}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={assignmentValue(task)}
                      onChange={(e) => {
                        reassign(task, e.target.value);
                      }}
                      aria-label="Asignación"
                      className={cellSelect}
                    >
                      <option value="">— Sin asignar —</option>
                      {members.length > 0 && (
                        <optgroup label="Personas">
                          {members.map((m) => (
                            <option key={m.user_id} value={`u:${m.user_id}`}>
                              {m.name} {m.last_name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {teams.length > 0 && (
                        <optgroup label="Equipos">
                          {teams.map((t) => (
                            <option key={t.id} value={`t:${t.id}`}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {location?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
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
    </div>
  );
}
