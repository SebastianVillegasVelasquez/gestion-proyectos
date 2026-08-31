import { useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useChangeTaskStatus } from "@/features/projects/hooks/use-tasks";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { ApiTeamTask } from "../api/workspace.api";

/**
 * "Comenzar": el propio responsable pasa su tarea de "sin iniciar" a
 * "en progreso". El backend ya autoriza esa transición al responsable y, al
 * moverla, avisa a quien coordina (líder/supervisor del equipo) — así se
 * enteran de que el trabajo arrancó sin tener que preguntar.
 *
 * Se dibuja solo, y solo cuando corresponde: si la tarea no es de quien mira o
 * ya está iniciada, no renderiza nada. Así se puede soltar en cualquier fila
 * sin condicionar desde fuera.
 */
export function StartTaskButton({ task, projectId }: { task: ApiTeamTask; projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const changeStatus = useChangeTaskStatus(projectId);

  const isMine = task.assignee_id != null && task.assignee_id === user?.id;
  if (!isMine || task.status !== "pendiente_por_iniciar") {
    return null;
  }

  return (
    <button
      type="button"
      disabled={changeStatus.isPending}
      onClick={() => {
        changeStatus.mutate(
          { taskId: task.id, status: "en_progreso" },
          {
            // El cambio de estado toca la caché de tareas del proyecto (lo hace
            // el hook) pero no la del workspace: la refrescamos para todos los
            // equipos que se estén viendo.
            onSuccess: () => {
              void qc.invalidateQueries({ queryKey: ["workspace", "tasks"] });
            },
          },
        );
      }}
      title="Marcar que empezaste a trabajar esta tarea (avisa a tu líder)"
      className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-teal/40 px-2 py-1 text-[11px] font-semibold text-brand-teal-dark transition-colors hover:bg-brand-teal/10 disabled:opacity-50 dark:text-brand-teal"
    >
      <Play className="size-3.5" />
      {changeStatus.isPending ? "…" : "Comenzar"}
    </button>
  );
}
