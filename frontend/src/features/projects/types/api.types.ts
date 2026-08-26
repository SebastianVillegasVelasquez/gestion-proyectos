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

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  note_date: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface CreateProjectNotePayload {
  content: string;
  // Opcional: si se omite, el backend usa la fecha de hoy.
  note_date?: string | null;
}

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

export interface UpdateTipoNodoPayload {
  nombre?: string;
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
  // True cuando este elemento termina DESPUÉS que su padre. No impide nada:
  // el árbol se reorganiza libremente y la UI ofrece cuadrar las fechas.
  conflicto_fechas: boolean;
}

/** Apunte de horas dedicadas a una tarea por una persona en un día. */
export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string | null;
  hours: string;
  work_date: string;
  notes: string | null;
  created_at: string | null;
}

export interface CreateTimeEntryPayload {
  hours: string;
  work_date: string;
  notes?: string | null;
}

/** Estimado vs. dedicado de una tarea, con el detalle de los apuntes. */
export interface TaskEffort {
  task_id: string;
  estimated_hours: string | null;
  logged_hours: string;
  entries: TimeEntry[];
}

/** Alta masiva de tareas a partir de una rama de la estructura. */
export interface BulkTasksFromBranchPayload {
  /** Solo los elementos sin contenido (los agrupadores no generan tarea). */
  only_leaves?: boolean;
  /** No duplicar: saltar los elementos que ya tienen tarea. */
  skip_with_tasks?: boolean;
  /** Heredar las fechas efectivas del elemento. */
  inherit_dates?: boolean;
  priority?: TaskPriority;
  assignee_id?: string | null;
  team_id?: string | null;
}

export interface SkippedElement {
  work_item_id: string;
  nombre: string;
  motivo: string;
}

export interface BulkTasksResult {
  created: Task[];
  skipped: SkippedElement[];
  total_elementos: number;
}

/** Elemento borrado tal como lo lista la papelera del proyecto. */
export interface TrashedItem {
  id: string;
  nombre: string;
  tipo_nombre: string | null;
  deleted_at: string | null;
  /** Cuántos elementos volverían con él (los que contenía). */
  contenido: number;
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

export interface MoveWorkItemPayload {
  /** Nuevo padre; null = mover al nivel raíz del proyecto. */
  new_parent_id?: string | null;
  /** Posición entre hermanos; si se omite, va al final. */
  orden?: number | null;
}

export interface ShiftWorkItemSubtreePayload {
  /** Días a sumar a las fechas plan del subárbol (negativo = mover atrás). */
  offset_days: number;
  /** Desplazar también las fechas de las tareas del subárbol (por defecto sí). */
  shift_tasks?: boolean;
}

export interface CloneWorkItemPayload {
  /** Donde pegar el elemento y su contenido; null = nivel principal del proyecto. */
  target_parent_id?: string | null;
  /** Desplazamiento (en días) de TODAS las fechas plan del clon. */
  offset_days?: number;
  /** Renombra solo el elemento principal del clon; lo que contiene conserva su nombre. */
  rename_root_to?: string | null;
  /** Cuántas copias pegar de una sola vez (por defecto 1). */
  times?: number;
  /** Copiar también las tareas del subárbol con su responsable/equipo (deep copy). */
  include_tasks?: boolean;
}

export interface WorkItemDependency {
  id: string;
  work_item_id: string;
  depends_on_id: string;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  project_id: string;
  // null = tarea suelta, todavía sin adjuntar a un elemento de la estructura.
  work_item_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assignee_id: string | null;
  team_id: string | null;
  // Fechas opcionales: una tarea puede crearse como borrador y planificarse luego.
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  /** Esfuerzo estimado en horas (null = sin estimar). */
  estimated_hours: string | null;
  /** Horas realmente dedicadas: suma de los apuntes, calculada en lectura. */
  logged_hours: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  // Equipo al que se delega la tarea (opcional).
  team_id?: string | null;
  // El proyecto es obligatorio salvo que se indique work_item_id (del que se
  // deriva). La tarea puede colgar de un elemento o crearse suelta.
  project_id?: string | null;
  work_item_id?: string | null;
  // Fecha de inicio opcional (la tarea puede quedar sin planificar).
  start_date?: string | null;
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
  team_id?: string | null;
  start_date?: string;
  due_date?: string;
  estimated_hours?: string | null;
}

export interface AttachTaskPayload {
  work_item_id: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
}

// ── Members / team ───────────────────────────────────────────────────────────

export type ProjectRole = "supervisor" | "coordinador" | "revisor" | "integrante" | "cliente";

export interface ProjectMember {
  id: string;
  user_id: string;
  name: string;
  last_name: string;
  email: string;
  position: string;
  project_role: ProjectRole;
}

// Integrante + su avance ponderado en ESTE proyecto (nunca cruzado con otros
// proyectos en los que también participe). `progress_pct` pesa cada tarea
// según la profundidad de su nodo en la estructura, no es completadas/total
// plano — es el número que determina cuándo corresponde pagarle su parte.
export interface ProjectMemberProgress extends ProjectMember {
  tasks_total: number;
  tasks_completed: number;
  progress_pct: number;
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

// Tipo de documento de identidad (opcional en el perfil del usuario).
export type DocumentType =
  | "cedula_ciudadania"
  | "cedula_extranjeria"
  | "pasaporte"
  | "tarjeta_identidad"
  | "nit";

// Usuario del directorio (para asignar tareas / agregar al equipo).
export interface DirectoryUser {
  id: string;
  name: string;
  last_name: string;
  email: string;
  position: UserPosition;
  document_type: DocumentType | null;
  document_number: string | null;
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
// Los equipos de trabajo viven dentro de un proyecto: se crean para ese
// proyecto y no existen fuera de él (otro proyecto tiene sus propios equipos).

// Rol del integrante DENTRO del equipo (distinto del rol en un proyecto).
export type TeamRole = "lider" | "supervisor" | "integrante";

export interface Team {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  member_count: number;
  assigned_tasks: number;
  completed_tasks: number;
  completion_pct: number;
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
  // Contexto adicional del evento (el backend puede omitirlos; el frontend los muestra si existen).
  work_item_name?: string | null;
  team_name?: string | null;
  assignee_name?: string | null;
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
