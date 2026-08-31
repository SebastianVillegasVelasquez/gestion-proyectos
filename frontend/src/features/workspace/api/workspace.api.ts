import http from "@/lib/http";
import type { Task } from "@/features/projects/types/api.types";
import type {
  CommentType,
  DeliverableStatus,
  ResourceType,
  TeamRole,
} from "@/features/workspace/types";

// ── Shapes del backend (snake_case) ─────────────────────────────────────────

export interface ApiMyTeam {
  id: string;
  name: string;
  description: string | null;
  // El equipo vive dentro de un proyecto: la Configuración del Grupo reutiliza
  // los endpoints /projects/{project_id}/teams/... para renombrar, cambiar
  // roles y archivar, en vez de duplicar esas rutas en el workspace.
  project_id: string;
}

export interface ApiTeamMember {
  user_id: string;
  name: string;
  last_name: string;
  position: string;
  team_role: TeamRole;
}

export interface ApiWorkspaceAccess {
  team_role: TeamRole | null;
  can_view: boolean;
  can_deliver: boolean;
  can_review: boolean;
}

export interface ApiVersion {
  id: string;
  version_number: number;
  type: ResourceType;
  url: string | null;
  note: string | null;
  /** Instrucciones para el siguiente rol. Interno del equipo (no va al cliente). */
  observations: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ApiComment {
  id: string;
  author_id: string;
  content: string;
  type: CommentType;
  mentions: string[];
  created_at: string;
}

export interface ApiDeliverable {
  id: string;
  team_id: string;
  task_title: string;
  assignee_id: string;
  // Fase 2: cuando el entregable está enganchado a una Task real del proyecto,
  // aprobar/rechazar aquí mueve el estado de la tarea y queda en trazabilidad.
  task_id: string | null;
  status: DeliverableStatus;
  versions: ApiVersion[];
  comments: ApiComment[];
  created_at: string;
  updated_at: string;
}

export interface CreateDeliverableBody {
  task_title: string;
  assignee_id: string;
  task_id?: string | null;
}

// Estado de tarea del proyecto (espejo del enum del backend). Reutiliza la
// máquina de estados existente: pendiente → en progreso → en revisión →
// completada/devuelta.
export type ProjectTaskStatus =
  | "pendiente_por_iniciar"
  | "en_progreso"
  | "en_revision"
  | "devuelta"
  | "completada"
  | "cancelada";

// Tarea delegada al equipo, con módulo y responsable resueltos (Fase 1).
export interface ApiTeamTask {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  priority: string;
  // Nullable: una tarea puede crearse suelta y colgarse del arbol mas tarde.
  work_item_id: string | null;
  work_item_name: string | null;
  project_id: string;
  project_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  parent_task_id: string | null;
  // Fechas opcionales: una tarea delegada puede estar aún sin planificar.
  start_date: string | null;
  due_date: string | null;
  // false (por defecto): quien la tiene asignada la entrega y queda hecha
  // directo. true: pasa por aprobación del líder/supervisor.
  requires_approval: boolean;
  // Dependencias finish-to-start ya resueltas a título por el backend: la vista
  // pinta "Bloqueada por: …" sin una llamada por fila.
  blocked_by: ApiBlockingTask[];
}

/** Tarea bloqueante (dependencia FtS), resumida para el indicador de bloqueo. */
export interface ApiBlockingTask {
  id: string;
  title: string;
  status: ProjectTaskStatus;
}

/** Interruptores de aviso del usuario actual DENTRO de un equipo concreto. */
export interface ApiTeamNotificationSettings {
  nueva_tarea_asignada: boolean;
  entregable_rechazado: boolean;
  comentario_nuevo: boolean;
  entregable_aprobado: boolean;
}

export interface NewVersionBody {
  type: ResourceType;
  /** Obligatoria salvo `type: "sin_adjunto"`. */
  url?: string;
  note?: string;
  observations?: string;
}

/** Corrección de una versión ya subida. Parcial: solo viaja lo que cambia. */
export interface EditVersionBody {
  type?: ResourceType;
  url?: string;
  note?: string;
  observations?: string;
}

export interface NewCommentBody {
  content: string;
  type: CommentType;
  mentions: string[];
}

/**
 * Alta de una tarea desde el espacio del equipo (la crea el líder/supervisor).
 * El equipo y el proyecto salen del contexto; aquí solo el qué, de qué elemento
 * cuelga, de qué tarea es subtarea y —opcional— quién la hace.
 */
export interface NewTeamTaskBody {
  title: string;
  assignee_id?: string | null;
  work_item_id?: string | null;
  parent_task_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  duration_days?: number | null;
  priority?: string;
  // Desactivado por defecto en el backend si se omite: la o el integrante
  // entrega y la subtarea queda hecha directo, sin pasar por el líder.
  requires_approval?: boolean;
}

const base = (teamId: string) => `/teams/${teamId}`;

export const workspaceApi = {
  myTeams: () => http.get<ApiMyTeam[]>("/teams/mine").then((r) => r.data),

  members: (teamId: string) =>
    http.get<ApiTeamMember[]>(`${base(teamId)}/members`).then((r) => r.data),

  access: (teamId: string) =>
    http.get<ApiWorkspaceAccess>(`${base(teamId)}/workspace/access`).then((r) => r.data),

  deliverables: (teamId: string) =>
    http.get<ApiDeliverable[]>(`${base(teamId)}/deliverables`).then((r) => r.data),

  tasks: (teamId: string) => http.get<ApiTeamTask[]>(`${base(teamId)}/tasks`).then((r) => r.data),

  createTask: (teamId: string, body: NewTeamTaskBody) =>
    http.post<Task>(`${base(teamId)}/tasks`, body).then((r) => r.data),

  createDeliverable: (teamId: string, body: CreateDeliverableBody) =>
    http.post<ApiDeliverable>(`${base(teamId)}/deliverables`, body).then((r) => r.data),

  addVersion: (teamId: string, deliverableId: string, body: NewVersionBody) =>
    http
      .post<ApiDeliverable>(`${base(teamId)}/deliverables/${deliverableId}/versions`, body)
      .then((r) => r.data),

  editVersion: (teamId: string, deliverableId: string, versionId: string, body: EditVersionBody) =>
    http
      .patch<ApiDeliverable>(
        `${base(teamId)}/deliverables/${deliverableId}/versions/${versionId}`,
        body,
      )
      .then((r) => r.data),

  addComment: (teamId: string, deliverableId: string, body: NewCommentBody) =>
    http
      .post<ApiDeliverable>(`${base(teamId)}/deliverables/${deliverableId}/comments`, body)
      .then((r) => r.data),

  // Solo quien entregó, y solo mientras no esté ya aprobado (ver backend).
  deleteDeliverable: (teamId: string, deliverableId: string) =>
    http.delete(`${base(teamId)}/deliverables/${deliverableId}`).then(() => undefined),

  notifications: (teamId: string) =>
    http
      .get<ApiTeamNotificationSettings>(`${base(teamId)}/workspace/notifications`)
      .then((r) => r.data),

  // PUT y no PATCH: el formulario manda siempre los cuatro interruptores, así
  // que el recurso se reemplaza completo (idempotente).
  updateNotifications: (teamId: string, body: ApiTeamNotificationSettings) =>
    http
      .put<ApiTeamNotificationSettings>(`${base(teamId)}/workspace/notifications`, body)
      .then((r) => r.data),
};
