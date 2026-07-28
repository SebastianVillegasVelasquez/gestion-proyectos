import { useMemo, useState } from "react";
import { X, ListPlus } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreateTask } from "../hooks/use-tasks";
import { useWorkTree } from "../hooks/use-structure";
import { useDirectory } from "../hooks/use-members";
import { useTeams } from "../hooks/use-teams";
import { TASK_PRIORITY_LABELS, USER_POSITION_LABELS, USER_POSITIONS } from "../types/labels";
import type { Task, TaskPriority, UserPosition } from "../types/api.types";
import { flattenWorkTree } from "../utils/flatten-work-tree";
import {
  buildTaskPayload,
  emptyTaskForm,
  validateTaskForm,
  type TaskFormState,
} from "./build-task-payload";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

const PRIORITIES: TaskPriority[] = ["no_definida", "baja", "media", "alta", "urgente"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function CreateTaskModal({
  projectId,
  tasks,
  initialWorkItemId,
  onClose,
}: {
  projectId: string;
  tasks: Task[];
  /** Preselecciona el elemento (p. ej. al crear desde un nodo de la estructura). */
  initialWorkItemId?: string;
  onClose: () => void;
}) {
  const treeQuery = useWorkTree(projectId);
  const createTask = useCreateTask(projectId);

  const [form, setForm] = useState<TaskFormState>(() => emptyTaskForm(initialWorkItemId));
  const [position, setPosition] = useState<UserPosition | "">("");
  const [clientError, setClientError] = useState<string | null>(null);

  const directoryQuery = useDirectory(position || undefined);
  const teamsQuery = useTeams(projectId);
  const teams = teamsQuery.data?.items ?? [];

  const set = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const nodeOptions = useMemo(() => flattenWorkTree(treeQuery.data ?? []), [treeQuery.data]);

  const handleSubmit = () => {
    const error = validateTaskForm(form);
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    createTask.mutate(buildTaskPayload(form, projectId), { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            <ListPlus className="size-4 text-brand-teal" /> Nueva tarea
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <Field label="Título *">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
              }}
              placeholder="Diseñar unidad 1"
            />
          </Field>
          <Field label="Descripción">
            <textarea
              className={inputCls}
              rows={2}
              value={form.description}
              onChange={(e) => {
                set("description", e.target.value);
              }}
            />
          </Field>

          {/* Nodo del árbol de trabajo al que cuelga la tarea (opcional: la
              tarea puede crearse suelta y adjuntarse después). */}
          <Field label="Ubicación en la estructura (opcional)">
            <select
              className={inputCls}
              value={form.workItemId}
              onChange={(e) => {
                set("workItemId", e.target.value);
              }}
            >
              <option value="">Sin asignar (tarea independiente)</option>
              {nodeOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
            {nodeOptions.length === 0 && (
              <span className="text-[11px] text-slate-400">
                Aún no hay estructura en este proyecto. Podrás adjuntar esta tarea a un elemento
                cuando la crees.
              </span>
            )}
          </Field>

          {/* Asignación: excluyente. Una tarea se da a una persona O a un equipo
              (o a nadie por ahora). Si va a un equipo, su líder reparte subtareas. */}
          <Field label="Asignar a">
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
              {(
                [
                  ["none", "Nadie aún"],
                  ["person", "Una persona"],
                  ["team", "Un equipo"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    set("assignmentMode", mode);
                    // Al cambiar de modo, limpiamos la selección del otro para no
                    // arrastrar valores incoherentes.
                    set("assigneeId", "");
                    set("teamId", "");
                    setPosition("");
                  }}
                  aria-pressed={form.assignmentMode === mode}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    form.assignmentMode === mode
                      ? "bg-white text-brand-teal-dark shadow-sm dark:bg-slate-900 dark:text-brand-teal"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Responsable individual: filtro por cargo + persona */}
          {form.assignmentMode === "person" && (
            <Field label="Responsable">
              <div className="flex gap-2">
                <select
                  className={`${inputCls} w-1/2`}
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value as UserPosition | "");
                    set("assigneeId", "");
                  }}
                >
                  <option value="">Todos los cargos</option>
                  {USER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {USER_POSITION_LABELS[p]}
                    </option>
                  ))}
                </select>
                <select
                  className={`${inputCls} w-1/2`}
                  value={form.assigneeId}
                  onChange={(e) => {
                    set("assigneeId", e.target.value);
                  }}
                >
                  <option value="">Sin asignar</option>
                  {directoryQuery.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {/* Delegar a un equipo: el líder repartirá subtareas dentro del equipo */}
          {form.assignmentMode === "team" && (
            <Field label="Equipo responsable">
              <select
                className={inputCls}
                value={form.teamId}
                onChange={(e) => {
                  set("teamId", e.target.value);
                }}
              >
                <option value="">Selecciona un equipo…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {teams.length === 0 && (
                <span className="text-[11px] text-slate-400">
                  Este proyecto aún no tiene equipos. Créalos en la sección «Equipos de trabajo».
                </span>
              )}
            </Field>
          )}

          {/* Dependencia */}
          <Field label="Depende de (opcional)">
            <select
              className={inputCls}
              value={form.dependsOnId}
              onChange={(e) => {
                set("dependsOnId", e.target.value);
              }}
            >
              <option value="">Sin dependencia</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>

          {/* Prioridad */}
          <Field label="Prioridad">
            <select
              className={inputCls}
              value={form.priority}
              onChange={(e) => {
                set("priority", e.target.value as TaskPriority);
              }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          {/* Fechas: inicio + (fin o duración) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio *">
              <input
                type="date"
                className={inputCls}
                value={form.startDate}
                onChange={(e) => {
                  set("startDate", e.target.value);
                }}
              />
            </Field>
            <Field label={form.dateMode === "duration" ? "Duración (días)" : "Fin"}>
              <div className="flex gap-1">
                {form.dateMode === "duration" ? (
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={form.durationDays}
                    onChange={(e) => {
                      set("durationDays", e.target.value);
                    }}
                  />
                ) : (
                  <input
                    type="date"
                    className={inputCls}
                    value={form.dueDate}
                    onChange={(e) => {
                      set("dueDate", e.target.value);
                    }}
                  />
                )}
                <button
                  type="button"
                  title="Cambiar entre duración y fecha de fin"
                  onClick={() => {
                    set("dateMode", form.dateMode === "duration" ? "end" : "duration");
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {form.dateMode === "duration" ? "📅" : "⏱"}
                </button>
              </div>
            </Field>
          </div>

          {(clientError ?? createTask.isError) && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {clientError ?? getErrorMessage(createTask.error, "No se pudo crear la tarea")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTask.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createTask.isPending ? "Creando…" : "Crear tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
