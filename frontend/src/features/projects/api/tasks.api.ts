import http from "@/lib/http";
import type {
  AttachTaskPayload,
  CreateTaskPayload,
  Task,
  TaskDependency,
  TaskStatus,
  UpdateTaskPayload,
} from "@/features/projects/types/api.types";

export const tasksApi = {
  // Todas las tareas del proyecto (resueltas vía su WorkItem).
  listByProject: (projectId: string) =>
    http.get<Task[]>(`/projects/${projectId}/tasks`).then((r) => r.data),

  // Tareas que cuelgan de un nodo concreto del árbol de trabajo.
  listByWorkItem: (workItemId: string) =>
    http.get<Task[]>(`/work-items/${workItemId}/tasks`).then((r) => r.data),

  // Crea una tarea bajo un WorkItem (el payload lleva work_item_id).
  create: (payload: CreateTaskPayload) => http.post<Task>("/tasks", payload).then((r) => r.data),

  update: (taskId: string, payload: UpdateTaskPayload) =>
    http.patch<Task>(`/tasks/${taskId}`, payload).then((r) => r.data),

  remove: (taskId: string) => http.delete(`/tasks/${taskId}`).then(() => undefined),

  // Adjunta una tarea suelta (o cambia de elemento) a un nodo de la estructura.
  attach: (taskId: string, payload: AttachTaskPayload) =>
    http.patch<Task>(`/tasks/${taskId}/attach`, payload).then((r) => r.data),

  // Quita la tarea de la estructura; vuelve a quedar suelta en el proyecto.
  detach: (taskId: string) => http.patch<Task>(`/tasks/${taskId}/detach`).then((r) => r.data),

  changeStatus: (taskId: string, status: TaskStatus, reason?: string) =>
    http
      .patch<Task>(`/tasks/${taskId}/status`, { status, change_reason: reason })
      .then((r) => r.data),

  listDependencies: (taskId: string) =>
    http.get<TaskDependency[]>(`/tasks/${taskId}/dependencies`).then((r) => r.data),

  // Todas las dependencias FtS del proyecto (para el cronograma).
  listProjectDependencies: (projectId: string) =>
    http.get<TaskDependency[]>(`/projects/${projectId}/task-dependencies`).then((r) => r.data),

  addDependency: (taskId: string, dependsOnId: string) =>
    http
      .post<TaskDependency>(`/tasks/${taskId}/dependencies`, {
        depends_on_id: dependsOnId,
      })
      .then((r) => r.data),
};
