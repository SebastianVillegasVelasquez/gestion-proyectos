import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useWorkTree } from "@/features/projects/hooks/use-structure";
import type { WorkItemTree } from "@/features/projects/types/api.types";
import { useCreateTeamTask, useTeamMembers } from "../hooks/use-workspace";

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/** Aplana el árbol a opciones con sangría por profundidad para un <select>. */
function flattenTree(nodes: WorkItemTree[], depth = 0): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, label: `${"".repeat(depth)}${n.nombre}` });
    if (n.children.length > 0) {
      out.push(...flattenTree(n.children, depth + 1));
    }
  }
  return out;
}

/**
 * Alta de una tarea desde el espacio del equipo (líder/supervisor). Distinta de
 * "Nueva subtarea": no cuelga de una tarea padre, sino —opcionalmente— de un
 * elemento de la estructura del proyecto. Puede nacer en la bolsa del equipo
 * (sin responsable) o ya asignada a un integrante.
 */
export function NewTeamTaskModal({
  teamId,
  projectId,
  onClose,
}: {
  teamId: string;
  projectId: string;
  onClose: () => void;
}) {
  const membersQuery = useTeamMembers(teamId);
  const members = membersQuery.data ?? [];
  const treeQuery = useWorkTree(projectId);
  const elementOptions = useMemo(() => flattenTree(treeQuery.data ?? []), [treeQuery.data]);
  const createTask = useCreateTeamTask(teamId);

  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationDays, setDurationDays] = useState("1");
  // Desactivado por defecto: la persona integrante entrega y la tarea queda
  // hecha directo, sin pasar por el líder de nuevo.
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await createTask.mutateAsync({
        title: title.trim(),
        assignee_id: assigneeId || null,
        work_item_id: workItemId || null,
        start_date: startDate || null,
        duration_days: startDate ? duration : undefined,
        requires_approval: requiresApproval,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo crear la tarea."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Nueva tarea</h2>
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
              placeholder="Ej: Guion del módulo 2"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Elemento de la estructura</label>
            <select
              aria-label="Elemento de la estructura"
              value={workItemId}
              onChange={(e) => {
                setWorkItemId(e.target.value);
              }}
              className={inputCls}
            >
              <option value="">Sin elemento (suelta en el proyecto)</option>
              {elementOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Responsable</label>
            <select
              aria-label="Responsable"
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
              }}
              className={inputCls}
            >
              <option value="">Sin asignar (bolsa del equipo)</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} {m.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Inicio</label>
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
              <label className={labelCls}>Duración (días)</label>
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
              disabled={createTask.isPending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {createTask.isPending ? "Creando…" : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
