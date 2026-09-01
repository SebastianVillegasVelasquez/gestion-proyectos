import http from "@/lib/http";
import type {
  ApiBlockingTask,
  ApiComment,
  ApiVersion,
} from "@/features/workspace/api/workspace.api";
import type { CommentType, DeliverableStatus, ResourceType } from "@/features/workspace/types";
import type { TaskPriority, TaskStatus } from "@/features/projects/types/api.types";

/** Una tarea asignada al usuario (cualquier proyecto). `team_id` presente = se
 * entrega por el espacio del equipo; ausente = entrega individual. */
export interface ApiMyTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string;
  project_name: string;
  work_item_id: string | null;
  work_item_name: string | null;
  team_id: string | null;
  team_name: string | null;
  parent_task_id: string | null;
  start_date: string | null;
  due_date: string | null;
  requires_approval: boolean;
  /** Avance 0-100 (backend). Para tareas padre cuyas subtareas no viajan en
   * esta lista es el avance por estado; la cifra fina vive en proyecto/equipo. */
  progress_pct: number;
  /** Días estimados de trabajo (número serializado como string por Decimal). */
  estimated_days: number | string | null;
  /** Motivo por el que aún no se puede entregar (mismo texto que el 422 del
   * servidor), o null si se puede. La UI desactiva "Entregar" con él. */
  delivery_blocked_reason: string | null;
  /** La tarea depende (FtS) de una «actividad de terceros». */
  depends_on_third_party: boolean;
  /** Dependencias FtS ya resueltas a título por el backend. */
  blocked_by: ApiBlockingTask[];
}

/** Entregable personal (sin equipo). Superset del entregable de equipo: trae
 * además en qué proyecto está y qué puede hacer con él quien lo pide. */
export interface ApiPersonalDeliverable {
  id: string;
  team_id: string | null;
  task_title: string;
  assignee_id: string;
  task_id: string | null;
  status: DeliverableStatus;
  versions: ApiVersion[];
  comments: ApiComment[];
  created_at: string;
  updated_at: string;
  project_id: string | null;
  project_name: string | null;
  task_requires_approval: boolean | null;
  viewer_is_owner: boolean;
  viewer_can_review: boolean;
}

export interface CreatePersonalDeliverableBody {
  task_title: string;
  task_id?: string | null;
  requires_approval?: boolean | null;
}

export interface AddVersionBody {
  type: ResourceType;
  url?: string;
  note?: string;
  observations?: string;
}

export interface UpdateVersionBody {
  type?: ResourceType;
  url?: string;
  note?: string;
  observations?: string;
}

export interface AddCommentBody {
  content: string;
  type: CommentType;
  mentions: string[];
}

const base = "/me/deliverables";

export const personalApi = {
  list: () => http.get<ApiPersonalDeliverable[]>(base).then((r) => r.data),

  /** «Mis tareas»: todo lo asignado a mí, de cualquier proyecto. */
  myTasks: () => http.get<ApiMyTask[]>("/me/tasks").then((r) => r.data),

  reviewQueue: () => http.get<ApiPersonalDeliverable[]>(`${base}/review-queue`).then((r) => r.data),

  create: (body: CreatePersonalDeliverableBody) =>
    http.post<ApiPersonalDeliverable>(base, body).then((r) => r.data),

  setApproval: (deliverableId: string, requiresApproval: boolean) =>
    http
      .patch<ApiPersonalDeliverable>(`${base}/${deliverableId}/approval`, {
        requires_approval: requiresApproval,
      })
      .then((r) => r.data),

  addVersion: (deliverableId: string, body: AddVersionBody) =>
    http
      .post<ApiPersonalDeliverable>(`${base}/${deliverableId}/versions`, body)
      .then((r) => r.data),

  updateVersion: (deliverableId: string, versionId: string, body: UpdateVersionBody) =>
    http
      .patch<ApiPersonalDeliverable>(`${base}/${deliverableId}/versions/${versionId}`, body)
      .then((r) => r.data),

  remove: (deliverableId: string) => http.delete(`${base}/${deliverableId}`).then(() => undefined),

  addComment: (deliverableId: string, body: AddCommentBody) =>
    http
      .post<ApiPersonalDeliverable>(`${base}/${deliverableId}/comments`, body)
      .then((r) => r.data),
};
