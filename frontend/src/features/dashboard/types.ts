// ─── Shared ───────────────────────────────────────────────────────────────────

export type AccentColor = "amber" | "emerald" | "blue" | "red";

// ─── KPI Cards ────────────────────────────────────────────────────────────────

export interface KpiCard {
  id: string;
  label: string;
  value: string | number;
  subtitle: string;
  accentColor: AccentColor;
}

// ─── Dashboard summary (API contract) ─────────────────────────────────────────

export interface DashboardSummary {
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_review_tasks: number;
  overdue_tasks: number;
}

// ─── Dashboard panels (API contract) ──────────────────────────────────────────
// Datos ya filtrados/ordenados/acotados por el backend (SQL). El frontend solo
// los transforma a los view-models de presentación.

export interface DashboardTaskItem {
  id: string;
  title: string;
  status: string; // value del enum de tareas del backend (ej. "en_progreso")
  project_name: string | null;
  /** Proyecto al que pertenece: permite agrupar y enlazar desde "Mis tareas". */
  project_id: string | null;
  due_date: string; // YYYY-MM-DD
}

export interface DashboardProjectItem {
  id: string;
  name: string;
  client_name: string | null;
  coordinator: string | null;
  tasks_total: number;
  tasks_completed: number;
  progress_pct: number;
  status: ProjectStatus;
}

export interface DashboardDeadlineItem {
  id: string;
  title: string;
  project_name: string | null;
  due_date: string; // YYYY-MM-DD
}

export interface DashboardPanels {
  task_board: DashboardTaskItem[];
  projects: DashboardProjectItem[];
  upcoming_deadlines: DashboardDeadlineItem[];
}

// ─── Actividad reciente (API contract) ────────────────────────────────────────
// Eventos del historial de tareas (todos los proyectos), ya clasificados por el
// backend. `kind` es el tipo semántico; el frontend le asigna icono/color/verbo.

export type ActivityKind =
  | "creacion"
  | "asignacion"
  | "inicio"
  | "entrega"
  | "aprobacion"
  | "devolucion"
  | "cancelacion"
  | "comentario"
  | "cambio_estado"
  // Cambios de gestión: explican la historia de la tarea aunque no muevan su estado.
  | "equipo"
  | "ubicacion"
  | "reprogramacion"
  | "prioridad";

export interface ActivityItem {
  id: string;
  task_id: string;
  task_title: string;
  project_name: string | null;
  actor_name: string | null;
  kind: ActivityKind;
  created_at: string; // ISO datetime
}

export interface RecentActivity {
  items: ActivityItem[];
}

// ─── Progreso de proyecto (solo lectura, rol User) ────────────────────────────

export interface MyProjectProgress {
  id: string;
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
  my_tasks: DashboardTaskItem[];
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in-progress" | "completed";

export type TagVariant = "project" | "date";

export interface TaskTag {
  label: string;
  variant: TagVariant;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  tags: TaskTag[];
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = "active" | "at-risk" | "in-review";

export interface Project {
  id: string;
  name: string;
  techBadge: string;
  status: ProjectStatus;
  coordinator: string;
  tasksTotal: number;
  tasksCompleted: number;
  progressPercent: number;
}

// ─── Deadlines ────────────────────────────────────────────────────────────────

export type Priority = "today" | "high" | "medium" | "low";

export interface Deadline {
  id: string;
  day: number;
  month: string;
  title: string;
  project: string;
  priority: Priority;
}
