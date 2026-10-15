import http from "@/lib/http";

export interface SeriesPoint {
  date: string;
  ideal: number;
  actual: number;
}
export interface WeekCount {
  week_start: string;
  count: number;
}
export interface AnalyticsOverview {
  total_tasks: number;
  by_status: Record<string, number>;
  progress_pct: number;
  overdue_open: number;
  at_risk_open: number;
  avg_schedule_slip_bdays: number;
  cycle_time_p50_bdays: number;
  cycle_time_p90_bdays: number;
  rework_rate_pct: number;
  throughput_last_weeks: WeekCount[];
}
export interface Burnup {
  window_start: string;
  window_end: string;
  total_scope: number;
  points: SeriesPoint[];
}
export interface MemberLoad {
  user_id: string;
  name: string;
  open_count: number;
}
export interface TeamPerformance {
  team_id: string;
  team_name: string;
  assigned: number;
  completed: number;
  open: number;
  overdue: number;
  cycle_time_bdays: number;
  review_time_bdays: number;
  rework_rate_pct: number;
  open_per_member: MemberLoad[];
}
export interface PersonPerformance {
  user_id: string;
  name: string;
  completed: number;
  open_count: number;
  cycle_time_bdays: number;
  on_time_pct: number;
  returns_received: number;
  logged_days: number;
}
export interface DeliveryLapse {
  task_id: string;
  task_title: string;
  element_path: string[];
  versions: number;
  production_bdays: number;
  review_bdays: number;
  total_bdays: number;
}
export interface AnalyticsTaskRow {
  task_id: string;
  title: string;
  element_path: string[];
  responsable: string | null;
  equipo: string | null;
  estado: string;
  prioridad: string;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  slip_bdays: number | null;
  returns: number;
  versions: number;
  /** Avance de la tarea: declarado por su responsable, por estado o de subtareas. */
  progress_pct: number;
}

export type PlanStatus = "on_track" | "watch" | "at_risk";
/** Lo esperado hoy según el cronograma frente a lo realmente completado. */
export interface PlanProgress {
  window_start: string;
  window_end: string;
  today: string;
  day_index: number;
  total_days: number;
  expected_tasks: number;
  expected_pct: number;
  completed_tasks: number;
  completed_pct: number;
  /** esperado - real, en puntos; positivo = por detrás del plan. */
  gap_pts: number;
  status: PlanStatus;
}

/** Salud de las tareas vivas (sin canceladas). */
export interface Health {
  total: number;
  completed: number;
  on_track: number;
  at_risk: number;
  overdue: number;
}

export type ComponentState =
  | "sin_tareas"
  | "sin_iniciar"
  | "en_curso"
  | "en_riesgo"
  | "atrasada"
  | "completada";

/** Estado de un componente de la estructura sumando TODO lo que cuelga de él.
 *  Llegan en orden de árbol (cada padre antes que sus hijos). */
export interface ComponentStats {
  id: string;
  parent_id: string | null;
  name: string;
  tipo_id: string | null;
  tipo_nombre: string | null;
  depth: number;
  path: string[];
  child_count: number;
  direct_tasks: number;
  total: number;
  completed: number;
  started: number;
  not_started: number;
  overdue: number;
  at_risk: number;
  completed_pct: number;
  started_pct: number;
  /** Media del avance de todas las tareas: cuenta también el trabajo empezado. */
  progress_pct: number;
  /** Cuánto llevan, de media, las tareas ya iniciadas. */
  started_progress_pct: number;
  state: ComponentState;
}

export interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  generated_at: string;
  filters: Record<string, string | null>;
  overview: AnalyticsOverview;
  burnup: Burnup;
  plan: PlanProgress;
  health: Health;
  by_team: TeamPerformance[];
  by_person: PersonPerformance[];
  delivery_lapses: DeliveryLapse[];
  tasks: AnalyticsTaskRow[];
  components: ComponentStats[];
}

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  team_id?: string;
  assignee_id?: string;
  status_filter?: string;
  priority?: string;
  work_item_id?: string;
}

function toParams(filters: AnalyticsFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => entry[1] != null && entry[1] !== "",
    ),
  );
}

export const analyticsApi = {
  get: (projectId: string, filters: AnalyticsFilters = {}) =>
    http
      .get<ProjectAnalytics>(`/projects/${projectId}/analytics`, {
        params: toParams(filters),
      })
      .then((r) => r.data),

  /** El informe como HTML autocontenido. Se pide como blob: es un archivo. */
  downloadHtml: (projectId: string, filters: AnalyticsFilters = {}) =>
    http
      .get<Blob>(`/projects/${projectId}/analytics.html`, {
        params: toParams(filters),
        responseType: "blob",
      })
      .then((r) => ({
        blob: r.data,
        disposition: r.headers["content-disposition"] as string | undefined,
      })),
};
