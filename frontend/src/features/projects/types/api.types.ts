// Contratos que coinciden con las respuestas del backend FastAPI.
// Los enums usan los VALUES que serializa Pydantic (minúscula para tareas,
// mayúscula para node_type porque su value == name en el backend).

export type NodeType = "PROGRAMA" | "CURSO" | "MODULO";

export type TaskStatus =
  | "pendiente_por_iniciar"
  | "en_progreso"
  | "en_revision"
  | "devuelta"
  | "completada"
  | "cancelada";

export type TaskPriority = "no_definida" | "baja" | "media" | "alta" | "urgente";

// ── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  progress_pct: number | null;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  client_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

// ── Phase ────────────────────────────────────────────────────────────────────

export interface Phase {
  id: string;
  name: string;
  order_index: number;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  project_id: string;
}

export interface CreatePhasePayload {
  name: string;
  order_index?: number | null;
  duration_days?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}

export type UpdatePhasePayload = Partial<CreatePhasePayload>;

// ── Node ─────────────────────────────────────────────────────────────────────

export interface ProjectNode {
  id: string;
  name: string;
  node_type: NodeType;
  project_id: string;
  parent_id: string | null;
  phase_id: string | null;
  type_label: string | null;
  end_date: string | null;
}

export interface CreateNodePayload {
  name: string;
  node_type: NodeType;
  project_id: string;
  parent_id?: string | null;
  phase_id?: string | null;
  type_label?: string | null;
  end_date?: string | null;
}

export interface UpdateNodePayload {
  name?: string;
  type_label?: string | null;
  phase_id?: string | null;
  end_date?: string | null;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  node_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assignee_id: string | null;
  start_date: string;
  due_date: string;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  start_date: string;
  due_date: string;
  parent_task_id?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  start_date?: string;
  due_date?: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
}

// ── Members / team ───────────────────────────────────────────────────────────

export type ProjectRole = "supervisor" | "coordinador" | "revisor" | "integrante" | "cliente";

export interface ProjectMember {
  user_id: string;
  name: string;
  last_name: string;
  position: string;
  project_role: ProjectRole;
}

export interface AddMemberPayload {
  user_id: string;
  project_id: string;
  project_role: ProjectRole;
}

// Usuario del sistema (para elegir a quién agregar al equipo).
export interface IdentityUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}
