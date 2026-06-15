import http from "@/features/auth/api/http";
import type {
  CreateTaskPayload,
  Task,
  TaskDependency,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

export const tasksApi = {
  listByNode: (projectId: string, nodeId: string) =>
    http.get<Task[]>(`/tasks/${projectId}/nodes/${nodeId}/tasks`).then((r) => r.data),

  create: (projectId: string, nodeId: string, payload: CreateTaskPayload) =>
    http.post<Task>(`/tasks/${projectId}/nodes/${nodeId}/tasks`, payload).then((r) => r.data),

  update: (projectId: string, nodeId: string, taskId: string, payload: UpdateTaskPayload) =>
    http
      .patch<Task>(`/tasks/${projectId}/nodes/${nodeId}/tasks/${taskId}`, payload)
      .then((r) => r.data),

  remove: (projectId: string, nodeId: string, taskId: string) =>
    http.delete(`/tasks/${projectId}/nodes/${nodeId}/tasks/${taskId}`).then(() => undefined),

  changeStatus: (projectId: string, taskId: string, status: TaskStatus, reason?: string) =>
    http
      .patch<Task>(`/tasks/${projectId}/tasks/${taskId}/status`, {
        status,
        change_reason: reason,
      })
      .then((r) => r.data),

  listDependencies: (projectId: string, taskId: string) =>
    http
      .get<TaskDependency[]>(`/tasks/${projectId}/tasks/${taskId}/dependencies`)
      .then((r) => r.data),

  addDependency: (projectId: string, taskId: string, dependsOnId: string) =>
    http
      .post<TaskDependency>(`/tasks/${projectId}/tasks/${taskId}/dependencies`, {
        depends_on_id: dependsOnId,
      })
      .then((r) => r.data),
};
