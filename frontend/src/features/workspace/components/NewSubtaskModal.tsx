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
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

/**
 * Modal del líder para partir una tarea general del equipo en subtareas.
 * Precarga fechas y duración desde la tarea padre para no obligar al líder a
 * calcularlas: la subtarea suele caer dentro del rango del padre.
 */
export function NewSubtaskModal({
  teamId,
  parent,
  onClose,
}: {
  teamId: string;
  parent: ApiTeamTask;
  onClose: () => void;
}) {
  const membersQuery = useTeamMembers(teamId);
  const members = membersQuery.data ?? [];
  const createSubtask = useCreateTeamSubtask(teamId);

  const [title, setTitle] = useState("");
  // Por defecto la subtarea la hace quien tiene la tarea padre: es lo más común
  // y evita volver a elegir. El líder puede cambiarlo aquí mismo antes de crear.
  const [assigneeId, setAssigneeId] = useState<string>(parent.assignee_id ?? "");
  // El padre puede estar sin planificar: precargamos sus fechas si existen,
  // pero dejamos que el líder las complete cuando falten.
  const [startDate, setStartDate] = useState(parent.start_date ?? "");
  const [durationDays, setDurationDays] = useState(
    parent.start_date && parent.due_date
      ? String(daysBetween(parent.start_date, parent.due_date))
      : "1",
  );
  const [error, setError] = useState<string | null>(null);
  // Desactivado por defecto, igual que al crear cualquier otra tarea.
  const [requiresApproval, setRequiresApproval] = useState(false);

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
    try {
      await createSubtask.mutateAsync({
        title: title.trim(),
        // La subtarea cuelga del mismo módulo que su padre.
        work_item_id: parent.work_item_id,
        parent_task_id: parent.id,
        // team_id lo hereda el backend del padre; no hace falta enviarlo.
        assignee_id: assigneeId || null,
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
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Nueva subtarea
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
              De «{parent.title}» — {parent.work_item_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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

          <div className="grid grid-cols-2 gap-3">
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
                value={durationDays}
                onChange={(e) => {
                  setDurationDays(e.target.value);
                }}
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => {
                setRequiresApproval(e.target.checked);
              }}
              className="size-4 accent-brand-gold"
            />
            <span className="text-slate-600 dark:text-slate-300">
              Requiere aprobación del líder o supervisor para darse por completada
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
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
