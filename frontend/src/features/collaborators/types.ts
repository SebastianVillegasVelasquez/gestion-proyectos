import type { TaskStatus, UserPosition } from "@/features/projects/types/api.types";

// Acción registrada en el historial de una tarea (espejo de HistoryAction del backend).
export type HistoryAction = "creacion" | "cambio_estado" | "reasignacion" | "comentario";

/** Fila de la tabla de colaboradores: identidad + avance de tareas. */
export interface CollaboratorListItem {
  user_id: string;
  name: string;
  last_name: string;
  position: UserPosition;
  assigned_tasks: number;
  completed_tasks: number;
  completion_pct: number;
}

export interface PaginatedCollaborators {
  items: CollaboratorListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CollaboratorTask {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string;
  completed_at: string | null;
}

export interface CollaboratorHistoryEntry {
  id: string;
  task_id: string;
  task_title: string;
  action: HistoryAction;
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  change_reason: string | null;
  created_at: string;
}

/** Detalle de actividad de un colaborador. */
export interface CollaboratorActivity {
  user_id: string;
  name: string;
  last_name: string;
  email: string;
  position: UserPosition;
  assigned_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  completion_pct: number;
  project_count: number;
  team_count: number;
  tasks: CollaboratorTask[];
  history: CollaboratorHistoryEntry[];
}

export interface CollaboratorSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
}
