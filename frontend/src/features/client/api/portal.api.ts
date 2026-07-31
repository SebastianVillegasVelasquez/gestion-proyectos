import http from "@/lib/http";

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

// Endpoint PÚBLICO: no requiere sesión. El token viaja en el cuerpo (no en la
// URL) para no filtrarlo en logs ni en el historial del navegador. Reutiliza el
// cliente http compartido (si no hay token de sesión, no manda Authorization; un
// 404 no dispara el flujo de refresh).
export const portalApi = {
  getProgress: (token: string) =>
    http.post<PublicProjectProgress>("/public/projects/progress", { token }).then((r) => r.data),
};
