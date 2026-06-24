// Contratos que coinciden con las respuestas del backend FastAPI.
// Los enums usan los VALUES que serializa Pydantic (minúscula para tareas).

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

// ── Árbol de trabajo (estructura flexible) ───────────────────────────────────
// La estructura de un proyecto es un árbol recursivo de WorkItems. Cada nivel
// (programa/curso/módulo/fase, o componente/actividad…) es del mismo tipo; lo
// que cambia es `tipo_id`, que apunta a un TipoNodo configurable por proyecto.

export type DuracionUnidad = "dias" | "semanas";

export interface TipoNodo {
  id: string;
  proyecto_id: string | null;
  nombre: string;
  color: string | null;
  icono: string | null;
  reglas_anidacion: Record<string, unknown> | null;
}

export interface CreateTipoNodoPayload {
  nombre: string;
  color?: string | null;
  icono?: string | null;
  reglas_anidacion?: Record<string, unknown> | null;
}

export interface WorkItem {
  id: string;
  proyecto_id: string;
  parent_id: string | null;
  tipo_id: string;
  nombre: string;
  orden: number;
  prioridad: number | null;
  // Fechas EFECTIVAS (el backend deriva las que falten con el motor de fechas).
  fecha_inicio_plan: string | null;
  fecha_fin_plan: string | null;
  duracion_valor: number | null;
  duracion_unidad: DuracionUnidad | null;
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  porcentaje_completado: number | null;
  es_transversal: boolean;
  // True cuando se dieron inicio+fin+duración inconsistentes (informativo).
  advertencia_fechas: boolean;
}

export interface WorkItemTree extends WorkItem {
  children: WorkItemTree[];
}

export interface CreateWorkItemPayload {
  tipo_id: string;
  nombre: string;
  parent_id?: string | null;
  orden?: number | null;
  prioridad?: number | null;
  fecha_inicio_plan?: string | null;
  fecha_fin_plan?: string | null;
  duracion_valor?: number | null;
  duracion_unidad?: DuracionUnidad | null;
  es_transversal?: boolean;
}

export type UpdateWorkItemPayload = Partial<Omit<CreateWorkItemPayload, "parent_id">>;

export interface CloneWorkItemPayload {
  /** Donde pegar el subárbol; null = raíz del proyecto. */
  target_parent_id?: string | null;
  /** Desplazamiento (en días) de TODAS las fechas plan del clon. */
  offset_days?: number;
  /** Renombra solo el nodo raíz del clon; los hijos conservan su nombre. */
  rename_root_to?: string | null;
}

export interface WorkItemDependency {
  id: string;
  work_item_id: string;
  depends_on_id: string;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  work_item_id: string;
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
  // La tarea cuelga de un nodo del árbol de trabajo (cualquier nivel).
  work_item_id: string;
  start_date: string;
  // Fecha de fin O duración en días (el backend calcula la fecha de fin).
  due_date?: string | null;
  duration_days?: number | null;
  // Dependencia opcional al crear (finish-to-start).
  depends_on_id?: string | null;
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
  email: string;
  position: string;
  project_role: ProjectRole;
}

export interface AddMemberPayload {
  user_id: string;
  project_id: string;
  project_role: ProjectRole;
}

// Cargo operativo del usuario (para filtrar responsables de tareas).
export type UserPosition =
  | "desarrollador"
  | "experto_multimedia"
  | "project_manager"
  | "sin_cargo"
  | "diseñador_instruccional"
  | "experto_tematico"
  | "corrector_estilo"
  | "diseñador_grafico"
  | "administrador_moodle";

// Usuario del directorio (para asignar tareas / agregar al equipo).
export interface DirectoryUser {
  id: string;
  name: string;
  last_name: string;
  email: string;
  position: UserPosition;
}

export interface PaginatedDirectory {
  items: DirectoryUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface DirectorySearchParams {
  search?: string;
  position?: UserPosition;
  page?: number;
  pageSize?: number;
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

// ── Teams (equipos de trabajo reutilizables) ─────────────────────────────────
// Los equipos viven en su propio bounded context: son plantillas reutilizables
// (ej. "Equipo de Desarrollo") que pueden asignarse a varios proyectos.

// Rol del integrante DENTRO del equipo (distinto del rol en un proyecto).
export type TeamRole = "lider" | "supervisor" | "integrante";

export interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

export interface PaginatedTeams {
  items: Team[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateTeamPayload {
  name: string;
  description?: string | null;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string | null;
}

export interface AddTeamMemberPayload {
  user_id: string;
  team_role?: TeamRole;
}

export interface TeamMember {
  user_id: string;
  name: string;
  last_name: string;
  position: string;
  team_role: TeamRole;
}

export interface TeamSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

// ── Trazabilidad (historial de eventos de un proyecto) ───────────────────────
export type HistoryAction = "creacion" | "cambio_estado" | "reasignacion" | "comentario";

// Tipo de evento clasificado por el backend (espejo del dominio).
export type TraceabilityEventKind =
  | "creacion"
  | "asignacion"
  | "inicio"
  | "entrega"
  | "aprobacion"
  | "devolucion"
  | "cancelacion"
  | "comentario"
  | "cambio_estado";

export interface TraceabilityEvent {
  id: string;
  task_id: string;
  task_title: string;
  actor_name: string | null;
  action: HistoryAction;
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  change_reason: string | null;
  created_at: string;
  kind: TraceabilityEventKind;
  is_delay: boolean;
}

export interface TraceabilitySummary {
  total_events: number;
  delays: number;
  deliveries: number;
  returns: number;
}

export interface ProjectTraceability {
  project_id: string;
  summary: TraceabilitySummary;
  events: TraceabilityEvent[];
}

// ── Progreso por área/equipo (agrupado por cargo) ────────────────────────────
export interface AreaProgress {
  position: UserPosition;
  member_count: number;
  assigned_tasks: number;
  completed_tasks: number;
  completion_pct: number;
}

export interface ProjectAreas {
  project_id: string;
  total_assigned: number;
  total_completed: number;
  areas: AreaProgress[];
}
