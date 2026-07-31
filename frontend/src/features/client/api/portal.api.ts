import http from "@/lib/http";
import type { TaskStatus } from "@/features/projects/types/api.types";

// Estado agregado del proyecto para el cliente (espejo de PublicProjectProgressResponse
// del backend). Sin `id` ni tareas individuales: el cliente solo ve el avance.
export type ProjectStatus = "active" | "at-risk" | "in-review";

export interface PublicProjectProgress {
  name: string;
  client_name: string | null;
  coordinator: string | null;
  status: ProjectStatus;
  tasks_total: number;
  tasks_completed: number;
  tasks_in_review: number;
  tasks_overdue: number;
  tasks_pending: number;
  progress_pct: number;
}

// Fila del cronograma público (espejo de PublicScheduleItemResponse): un ELEMENTO
// de la estructura con su tiempo, no una tarea. El cliente ve el flujo del
// proyecto por sus componentes/entregables. `key`/`parent_key` son índices opacos
// (no ids internos) para reconstruir la jerarquía; `start_date`/`due_date` llegan
// como YYYY-MM-DD, listas para los helpers del cronograma.
export interface PublicScheduleItem {
  key: string;
  parent_key: string | null;
  name: string;
  depth: number;
  order: number;
  start_date: string;
  due_date: string;
  status: TaskStatus;
  progress_pct: number;
}

export interface PublicProjectSchedule {
  project_name: string;
  items: PublicScheduleItem[];
}

// Endpoint PÚBLICO: no requiere sesión. El token viaja en el cuerpo (no en la
// URL) para no filtrarlo en logs ni en el historial del navegador. Reutiliza el
// cliente http compartido (si no hay token de sesión, no manda Authorization; un
// 404 no dispara el flujo de refresh).
export const portalApi = {
  getProgress: (token: string) =>
    http.post<PublicProjectProgress>("/public/projects/progress", { token }).then((r) => r.data),
  getSchedule: (token: string) =>
    http
      .post<PublicProjectSchedule>("/public/projects/schedule", { token })
      .then((r) => r.data),
};
