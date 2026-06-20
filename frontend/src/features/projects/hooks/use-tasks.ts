import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { taskKeys } from "./query-keys";
import type { CreateTaskPayload, TaskStatus } from "@/features/projects/types/api.types";

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

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      void qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: taskKeys.byWorkItem(task.work_item_id) });
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

export function useAddTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      tasksApi.addDependency(taskId, dependsOnId),
    onSuccess: (_data, { taskId }) =>
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) }),
  });
}
