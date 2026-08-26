import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { projectKeys, taskKeys } from "./query-keys";
import type {
  BulkTasksFromBranchPayload,
  CreateTaskPayload,
  CreateTimeEntryPayload,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

/** Todas las tareas del proyecto (resueltas vía su WorkItem). */
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
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
    },
  });
}

export function useDeleteTimeEntry(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => tasksApi.deleteTimeEntry(entryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.effort(taskId) });
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
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
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId) });
    },
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
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
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
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
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: [...taskKeys.all, "work-item"] });
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
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
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

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      tasksApi.addDependency(taskId, dependsOnId),
    onSuccess: (_data, { taskId }) =>
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) }),
  });
}
