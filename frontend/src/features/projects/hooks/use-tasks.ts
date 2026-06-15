import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { taskKeys } from "./query-keys";
import type {
  CreateTaskPayload,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

export function useNodeTasks(projectId: string, nodeId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byNode(projectId, nodeId ?? ""),
    queryFn: () => tasksApi.listByNode(projectId, nodeId!),
    enabled: Boolean(projectId && nodeId),
  });
}

export function useCreateTask(projectId: string, nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(projectId, nodeId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byNode(projectId, nodeId) }),
  });
}

export function useUpdateTask(projectId: string, nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
      tasksApi.update(projectId, nodeId, taskId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byNode(projectId, nodeId) }),
  });
}

export function useChangeTaskStatus(projectId: string, nodeId: string) {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.byNode(projectId, nodeId) }),
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
