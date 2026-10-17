import { useState } from "react";
import { X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreateTeamSubtask, useTeamMembers } from "../hooks/use-workspace";
import type { ApiTeamTask } from "../api/workspace.api";

// Diferencia en días entre dos fechas ISO (YYYY-MM-DD). Positivo si a ≤ b.
function daysBetween(a: string, b: string): number {
  const toDay = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
  return Math.max(1, toDay(b) - toDay(a) + 1);
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * Modal del líder para partir una tarea general del equipo en subtareas.
 * Precarga fechas y duración desde la tarea padre para no obligar al líder a
 * calcularlas: la subtarea suele caer dentro del rango del padre.
 */
export function NewSubtaskModal({
  teamId,
  parent,
  siblings,
  onClose,
}: {
  teamId: string;
  parent: ApiTeamTask;
  /** Subtareas ya existentes de la misma tarea padre: una de ellas puede ser
   *  la dependencia FtS de la nueva (no se puede empezar antes que ella). */
  siblings: ApiTeamTask[];
  onClose: () => void;
}) {
  const membersQuery = useTeamMembers(teamId);
  const members = membersQuery.data ?? [];
  const createSubtask = useCreateTeamSubtask(teamId);

  const [title, setTitle] = useState("");
  // Dependencia opcional: hasta que esta hermana esté completada, la nueva
  // subtarea no puede iniciarse. Su fecha de fin marca el inicio de esta.
  const [dependsOnId, setDependsOnId] = useState("");
  // Por defecto la subtarea la hace quien tiene la tarea padre: es lo más común
  // y evita volver a elegir. El líder puede cambiarlo aquí mismo antes de crear.
  const [assigneeId, setAssigneeId] = useState<string>(parent.assignee_id ?? "");
  // El padre puede estar sin planificar: precargamos sus fechas si existen,
  // pero dejamos que el líder las complete cuando falten.
  const [startDate, setStartDate] = useState(parent.start_date ?? "");
  // Un día por defecto: heredar todo el plazo del padre hacía que cada subtarea
  // venciera el mismo día que él. El líder ajusta la duración real.
  const [durationDays, setDurationDays] = useState("1");
  const [error, setError] = useState<string | null>(null);
  // Desactivado por defecto, igual que al crear cualquier otra tarea.
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Días disponibles entre el inicio elegido y el fin del padre: la subtarea no
  // puede pasarse de ahí (el backend también lo exige).
  const maxDuration =
    startDate && parent.due_date && startDate <= parent.due_date
      ? daysBetween(startDate, parent.due_date)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 2) {
      setError("El título debe tener al menos 2 caracteres.");
      return;
    }
    const duration = Number(durationDays);
    if (startDate && (!Number.isFinite(duration) || duration <= 0)) {
      setError("La duración debe ser mayor a 0 días.");
      return;
    }
    if (startDate && parent.due_date && startDate > parent.due_date) {
      setError(
        `La subtarea no puede empezar después de que termine la tarea padre (${parent.due_date}).`,
      );
      return;
    }
    if (maxDuration !== null && duration > maxDuration) {
      setError(
        `La tarea padre termina el ${parent.due_date ?? ""}: la duración máxima es ${String(maxDuration)} día(s).`,
      );
      return;
    }
    try {
      await createSubtask.mutateAsync({
        title: title.trim(),
        // La subtarea cuelga del mismo módulo que su padre.
        work_item_id: parent.work_item_id,
        parent_task_id: parent.id,
        // team_id lo hereda el backend del padre; no hace falta enviarlo.
        assignee_id: assigneeId || null,
        depends_on_id: dependsOnId || undefined,
        // Sin fecha de inicio, la subtarea queda sin planificar (como el padre).
        start_date: startDate || null,
        duration_days: startDate ? duration : undefined,
        requires_approval: requiresApproval,
      });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo crear la subtarea."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Nueva subtarea</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              De «{parent.title}» — {parent.work_item_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>Título *</label>
            <input
              type="text"
              value={title}
              autoFocus
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="Ej: Diseñar variante móvil"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Responsable</label>
            <select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
              }}
              className={inputCls}
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.last_name}
                </option>
              ))}
            </select>
          </div>

          {siblings.length > 0 && (
            <div>
              <label className={labelCls}>Depende de</label>
              <select
                value={dependsOnId}
                onChange={(e) => {
                  const next = e.target.value;
                  setDependsOnId(next);
                  // Arranca cuando termina su dependencia: precargamos la fecha
                  // de inicio con el fin de la hermana elegida.
                  const dep = siblings.find((s) => s.id === next);
                  if (dep?.due_date) {
                    setStartDate(dep.due_date);
                  }
                }}
                className={inputCls}
              >
                <option value="">Sin dependencia</option>
                {siblings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                No podrá comenzar hasta que esa subtarea esté completada.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Inicio *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Duración (días) *</label>
              <input
                type="number"
                min={1}
                max={maxDuration ?? undefined}
                value={durationDays}
                onChange={(e) => {
                  setDurationDays(e.target.value);
                }}
                className={inputCls}
              />
              {maxDuration !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Máximo {maxDuration} día(s): el padre termina el {parent.due_date}.
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => {
                setRequiresApproval(e.target.checked);
              }}
              className="size-4 accent-brand-gold"
            />
            <span className="text-muted-foreground">
              Requiere aprobación del líder o supervisor para darse por completada
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createSubtask.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {createSubtask.isPending ? "Creando…" : "Crear subtarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
