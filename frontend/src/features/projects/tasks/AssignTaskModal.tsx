import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateTask } from "../hooks/use-tasks";
import type { ProjectMember, Task, Team } from "../types/api.types";

type Assignment = "person" | "team";

const controlCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/**
 * Modal de asignación rápida para una tarea aún SIN responsable. Reutiliza el
 * patrón del formulario de tareas (persona XOR equipo) pero acotado a asignar:
 * la reasignación de una tarea ya asignada vive en la edición de la tarea, no
 * en la tabla. Así la tabla queda como vista de consulta y esta acción cubre el
 * hueco de "asignar por primera vez" sin abrir el panel completo.
 */
export function AssignTaskModal({
  projectId,
  task,
  members,
  teams,
  onClose,
}: {
  projectId: string;
  task: Task;
  members: ProjectMember[];
  teams: Team[];
  onClose: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const [mode, setMode] = useState<Assignment>("person");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");

  const canSave = mode === "person" ? assigneeId !== "" : teamId !== "";

  const save = () => {
    if (!canSave) {
      return;
    }
    const payload =
      mode === "person"
        ? { assignee_id: assigneeId, team_id: null }
        : { team_id: teamId, assignee_id: null };
    updateTask.mutate({ taskId: task.id, payload }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <UserPlus className="size-4 text-brand-teal" /> Asignar tarea
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="truncate text-sm font-medium text-foreground" title={task.title}>
            {task.title}
          </p>

          {/* Persona XOR equipo (misma regla que el formulario de tareas). */}
          <div className="flex gap-1 rounded-lg border border-border bg-accent/40 p-1">
            {(
              [
                ["person", "Una persona"],
                ["team", "Un equipo"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setAssigneeId("");
                  setTeamId("");
                }}
                aria-pressed={mode === id}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
                  mode === id
                    ? "bg-card text-brand-teal-dark shadow-sm dark:text-brand-teal"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "person" ? (
            <select
              className={controlCls}
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
              }}
              aria-label="Persona responsable"
            >
              <option value="">Selecciona a una persona…</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.last_name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select
                className={controlCls}
                value={teamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                }}
                aria-label="Equipo responsable"
              >
                <option value="">Selecciona un equipo…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {teams.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Este proyecto aún no tiene equipos. Créalos en «Equipos de trabajo».
                </span>
              )}
            </>
          )}

          {updateTask.isError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(updateTask.error, "No se pudo asignar la tarea")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || updateTask.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateTask.isPending ? "Asignando…" : "Asignar"}
          </button>
        </div>
      </div>
    </div>
  );
}
