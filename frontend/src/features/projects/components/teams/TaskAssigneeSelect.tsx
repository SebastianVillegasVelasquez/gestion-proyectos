import { useUpdateTask } from "../../hooks/use-tasks";
import { fullName } from "../../utils/task-assignment";
import type { TeamMember } from "../../types/api.types";

/**
 * Reasigna una tarea a otro integrante DEL MISMO equipo. Es la única potestad
 * del líder sobre tareas que no son suyas: cambiarlas de manos dentro de su
 * equipo, sin abrir el formulario completo de edición (que es de administración).
 *
 * Solo se toca `assignee_id`: la tarea conserva su `team_id`, así sigue siendo
 * "del equipo" y el líder puede volver a reasignarla más adelante.
 */
export function TaskAssigneeSelect({
  projectId,
  taskId,
  currentAssigneeId,
  members,
  onDone,
}: {
  projectId: string;
  taskId: string;
  currentAssigneeId: string | null;
  members: TeamMember[];
  onDone?: () => void;
}) {
  const update = useUpdateTask(projectId);

  return (
    <div className="flex flex-col gap-1">
      <select
        value={currentAssigneeId ?? ""}
        disabled={update.isPending}
        onChange={(e) => {
          const next = e.target.value || null;
          if (next === currentAssigneeId) {
            return;
          }
          update.mutate({ taskId, payload: { assignee_id: next } }, { onSuccess: onDone });
        }}
        aria-label="Reasignar responsable"
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-brand-gold disabled:opacity-60"
      >
        <option value="">Sin responsable</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {fullName(m)}
          </option>
        ))}
      </select>
      {update.isError && (
        <span className="text-[11px] text-rose-600 dark:text-rose-400">
          No se pudo reasignar. Revisa que la persona siga en el equipo.
        </span>
      )}
    </div>
  );
}
