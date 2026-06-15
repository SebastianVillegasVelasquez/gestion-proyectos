import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { taskKeys } from "./query-keys";
import type { CreateTaskPayload, TaskStatus } from "@/features/projects/types/api.types";

/** Todas las tareas del proyecto (las de nodo y las de fase). */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId ?? ""),
    queryFn: () => tasksApi.listByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }),
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
    }) => tasksApi.changeStatus(projectId, taskId, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }),
  });
}

export function useTaskDependencies(projectId: string, taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.dependencies(projectId, taskId ?? ""),
    queryFn: () => tasksApi.listDependencies(projectId, taskId!),
    enabled: Boolean(projectId && taskId),
  });
}

export function useAddTaskDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      tasksApi.addDependency(projectId, taskId, dependsOnId),
    onSuccess: (_data, { taskId }) =>
      qc.invalidateQueries({ queryKey: taskKeys.dependencies(projectId, taskId) }),
  });
}
