import type { TraceabilityEvent, TraceabilityEventKind } from "@/features/projects/types/api.types";

// Etiqueta legible por tipo de evento (presentación de la línea de tiempo).
export const TRACE_EVENT_LABELS: Record<TraceabilityEventKind, string> = {
  creacion: "Tarea creada",
  asignacion: "Responsable asignado",
  inicio: "Inicio de ejecución",
  entrega: "Entrega",
  aprobacion: "Entrega aprobada",
  devolucion: "Tarea devuelta",
  cancelacion: "Tarea cancelada",
  comentario: "Comentario",
  cambio_estado: "Cambio de estado",
  equipo: "Cambio de equipo",
  ubicacion: "Cambio de ubicación",
  reprogramacion: "Fechas movidas",
  prioridad: "Cambio de prioridad",
};

/** Agrupaciones que ofrece el selector de la línea de tiempo. Se filtra por
 * intención ("¿qué pasó con el reparto del trabajo?") y no por cada tipo
 * suelto: son doce tipos y nadie quiere doce casillas. */
export const TRACE_FILTER_GROUPS = {
  todos: null,
  retrasos: null, // caso especial: mira `is_delay`, no el tipo
  flujo: ["creacion", "inicio", "entrega", "aprobacion", "devolucion", "cancelacion"],
  reparto: ["asignacion", "equipo", "ubicacion"],
  gestion: ["reprogramacion", "prioridad", "cambio_estado"],
  conversacion: ["comentario"],
} satisfies Record<string, TraceabilityEventKind[] | null>;

export type TraceFilterGroup = keyof typeof TRACE_FILTER_GROUPS;

export const TRACE_FILTER_LABELS: Record<TraceFilterGroup, string> = {
  todos: "Todos",
  retrasos: "Solo retrasos",
  flujo: "Flujo de trabajo",
  reparto: "Reparto",
  gestion: "Gestión",
  conversacion: "Conversación",
};

export interface TraceabilityFilters {
  group: TraceFilterGroup;
  /** Id del equipo por el que acotar, o `null` para no acotar. */
  teamId: string | null;
  /** Texto libre contra el título de la tarea y el nombre de quien actuó. */
  search: string;
}

export const EMPTY_TRACE_FILTERS: TraceabilityFilters = {
  group: "todos",
  teamId: null,
  search: "",
};

/**
 * Filtra la línea de tiempo. Función pura sobre los datos ya traídos: la lista
 * viene acotada a los 300 eventos más recientes, así que filtrar en cliente es
 * inmediato y no cuesta una ida al servidor por cada casilla que se marca.
 */
export function filterTraceabilityEvents(
  events: TraceabilityEvent[],
  filters: TraceabilityFilters,
): TraceabilityEvent[] {
  // Anotado a mano: con `satisfies`, cada grupo es una tupla de literales y la
  // unión de todas ellas hace que `includes` acepte solo `never`.
  const kinds: TraceabilityEventKind[] | null = TRACE_FILTER_GROUPS[filters.group];
  const needle = filters.search.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.group === "retrasos" && !event.is_delay) {
      return false;
    }
    if (kinds && !kinds.includes(event.kind)) {
      return false;
    }
    if (filters.teamId && event.team_id !== filters.teamId) {
      return false;
    }
    if (needle) {
      const haystack = `${event.task_title} ${event.actor_name ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

/** Equipos presentes en la línea de tiempo, para poblar el selector sin pedir
 * la lista de equipos por separado. */
export function teamsInTimeline(events: TraceabilityEvent[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const event of events) {
    if (event.team_id && event.team_name) {
      byId.set(event.team_id, event.team_name);
    }
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
