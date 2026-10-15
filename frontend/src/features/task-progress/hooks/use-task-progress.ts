import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskProgressApi, type RegisterProgressBody } from "../api/task-progress.api";

export const taskProgressKeys = {
  detail: (taskId: string) => ["task-progress", taskId] as const,
};

/** Avance de una tarea con su bitácora y la evidencia reutilizable. */
export function useTaskProgress(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: taskProgressKeys.detail(taskId ?? ""),
    queryFn: () => taskProgressApi.get(taskId ?? ""),
    enabled: Boolean(taskId) && enabled,
  });
}

/** Edita el avance con evidencia y refresca todas las vistas que lo pintan. */
export function useRegisterTaskProgress(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterProgressBody) => taskProgressApi.register(taskId, body),
    onSuccess: (data) => {
      qc.setQueryData(taskProgressKeys.detail(taskId), data);
      // El avance se ve en listas de proyecto, equipo, «Mis tareas» y paneles;
      // el archivo nuevo aparece además en el archivador.
      for (const key of ["tasks", "workspace", "dashboard", "personal-deliverables"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
