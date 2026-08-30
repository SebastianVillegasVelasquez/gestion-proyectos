import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { projectKeys, taskKeys } from "./query-keys";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard-summary";
import type {
  BulkTasksFromBranchPayload,
  CreateCommentPayload,
  CreateTaskPayload,
  CreateTimeEntryPayload,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

/** Todas las tareas del proyecto (resueltas vía su WorkItem). */
/**
 * Invalidaciones comunes a toda mutación de una tarea.
 *
 * Cualquier cambio deja huella en el historial, así que la trazabilidad y la
 * actividad reciente quedan obsoletas igual que el listado. Centralizado aquí
 * para que añadir una mutación nueva no se olvide de refrescarlas.
 */
function invalidateTaskViews(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
  void qc.invalidateQueries({ queryKey: projectKeys.traceability(projectId) });
  // Prefijo: cubre la actividad global y la del proyecto.
  void qc.invalidateQueries({ queryKey: dashboardKeys.activity() });
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? ""),
    queryFn: () => tasksApi.listByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

/** Tareas que cuelgan de un nodo concreto del árbol. */
export function useWorkItemTasks(workItemId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byWorkItem(workItemId ?? ""),
    queryFn: () => tasksApi.listByWorkItem(workItemId!),
    enabled: Boolean(workItemId),
  });
}

/** Conversación de una tarea. */
export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.comments(taskId ?? ""),
    queryFn: () => tasksApi.comments(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => tasksApi.addComment(taskId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) }),
  });
}

/** Esfuerzo de una tarea: estimación, horas dedicadas y sus apuntes. */
export function useTaskEffort(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.effort(taskId ?? ""),
    queryFn: () => tasksApi.effort(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useLogTime(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimeEntryPayload) => tasksApi.logTime(taskId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.effort(taskId) });
      // La lista del proyecto muestra "3 / 8 h" por fila: también cambia.
      invalidateTaskViews(qc, projectId);
    },
  });
}

export function useDeleteTimeEntry(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => tasksApi.deleteTimeEntry(entryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.effort(taskId) });
      invalidateTaskViews(qc, projectId);
    },
  });
}

/** Alta masiva de tareas desde una rama de la estructura. */
export function useCreateTasksFromBranch(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: BulkTasksFromBranchPayload }) =>
      tasksApi.createFromBranch(itemId, payload),
    onSuccess: () => {
      // Toca a muchos elementos a la vez: invalidamos las tareas del proyecto
      // en bloque en vez de intentar acertar con cada elemento tocado.
      invalidateTaskViews(qc, projectId);
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
    },
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      invalidateTaskViews(qc, projectId);
      if (task.work_item_id) {
        void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
      }
    },
  });
}

/** Adjunta una tarea suelta (o la cambia de elemento) a un nodo de la estructura. */
export function useAttachTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, workItemId }: { taskId: string; workItemId: string }) =>
      tasksApi.attach(taskId, { work_item_id: workItemId }),
    onSuccess: () => {
      invalidateTaskViews(qc, projectId);
      // Cualquier vista "tareas por elemento" puede haber cambiado.
      void qc.invalidateQueries({ queryKey: [...taskKeys.all, "work-item"] });
    },
  });
}

/** Quita la tarea de la estructura; vuelve a quedar suelta en el proyecto. */
export function useDetachTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.detach(taskId),
    onSuccess: () => {
      invalidateTaskViews(qc, projectId);
      void qc.invalidateQueries({ queryKey: [...taskKeys.all, "work-item"] });
    },
  });
}

/**
 * Elimina una tarea (borrado lógico en el backend: `deleted_at`). Al quedar
 * marcada, desaparece de golpe de todas las vistas que ya filtran por tareas
 * vivas — proyecto, equipo, espacio de trabajo del líder — sin tocar nada más
 * en cada una de ellas. El responsable (si tenía) también deja de verla: la
 * asignación vive en la propia fila de la tarea, no en una tabla aparte.
 */
export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.remove(taskId),
    onSuccess: () => {
      invalidateTaskViews(qc, projectId);
      // Prefijo: cubre también las vistas "tareas por elemento" y por equipo.
      void qc.invalidateQueries({ queryKey: taskKeys.all });
      // La bolsa de tareas y el tablero del espacio de trabajo del líder viven
      // en su propio namespace de queries, fuera de `taskKeys` — sin esto la
      // tarea borrada seguía viéndose ahí hasta la siguiente recarga.
      void qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

/**
 * Edita los datos de una tarea (título, prioridad, fechas, responsable/equipo).
 * Es una acción de administración: PATCH /tasks/{id}. Para reasignar de persona a
 * equipo (o viceversa) el llamador envía el otro campo en null, ya que el backend
 * exige responsable XOR equipo.
 */
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
      tasksApi.update(taskId, payload),
    onSuccess: (task) => {
      invalidateTaskViews(qc, projectId);
      if (task.work_item_id) {
        void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
      }
    },
  });
}

export function useChangeTaskStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      status,
      reason,
    }: {
      taskId: string;
      status: TaskStatus;
      reason?: string;
    }) => tasksApi.changeStatus(taskId, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }),
  });
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.dependencies(taskId ?? ""),
    queryFn: () => tasksApi.listDependencies(taskId!),
    enabled: Boolean(taskId),
  });
}

/** Todas las dependencias FtS del proyecto, para dibujar flechas en el Gantt. */
export function useProjectTaskDependencies(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.projectDependencies(projectId ?? ""),
    queryFn: () => tasksApi.listProjectDependencies(projectId!),
    enabled: Boolean(projectId),
  });
}

interface DependencyVars {
  taskId: string;
  dependsOnId: string;
  /** Del proyecto: refresca también las flechas FtS del cronograma. */
  projectId?: string;
}

function invalidateDeps(qc: ReturnType<typeof useQueryClient>, vars: DependencyVars) {
  void qc.invalidateQueries({ queryKey: taskKeys.dependencies(vars.taskId) });
  if (vars.projectId) {
    void qc.invalidateQueries({
      queryKey: taskKeys.projectDependencies(vars.projectId),
    });
  }
}

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: DependencyVars) =>
      tasksApi.addDependency(taskId, dependsOnId),
    onSuccess: (_data, vars) => {
      invalidateDeps(qc, vars);
    },
  });
}

export function useRemoveTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: DependencyVars) =>
      tasksApi.removeDependency(taskId, dependsOnId),
    onSuccess: (_data, vars) => {
      invalidateDeps(qc, vars);
    },
  });
}
