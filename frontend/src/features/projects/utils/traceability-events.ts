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

/** Un día de la línea de tiempo: los eventos comparten fecha y se pintan bajo
 *  una misma cabecera. Los eventos llegan del backend en orden descendente. */
export interface TraceabilityDay {
  /** Fecha ISO (YYYY-MM-DD) del grupo. */
  date: string;
  events: TraceabilityEvent[];
}

/**
 * Agrupa la línea de tiempo por día. Leer un historial largo sin cortes de
 * fecha obliga a comparar marcas de tiempo evento a evento; con la fecha como
 * cabecera se ve de un vistazo qué pasó "ese martes".
 */
export function groupEventsByDay(events: TraceabilityEvent[]): TraceabilityDay[] {
  const days: TraceabilityDay[] = [];
  for (const event of events) {
    const date = event.created_at.slice(0, 10);
    const last = days[days.length - 1];
    if (last?.date === date) {
      last.events.push(event);
    } else {
      days.push({ date, events: [event] });
    }
  }
  return days;
}

/** Una fila del desglose lateral: qué, cuántas veces y qué parte del total. */
export interface TraceabilityTally<T extends string = string> {
  key: T;
  label: string;
  count: number;
  /** 0-100, sobre el más frecuente: es una barra comparativa, no un porcentaje. */
  share: number;
}

function tally<T extends string>(pairs: [T, string][]): TraceabilityTally<T>[] {
  const counts = new Map<T, { label: string; count: number }>();
  for (const [key, label] of pairs) {
    const found = counts.get(key);
    if (found) {
      found.count += 1;
    } else {
      counts.set(key, { label, count: 1 });
    }
  }
  const rows = [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count, share: 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const top = rows[0]?.count ?? 0;
  return rows.map((r) => ({ ...r, share: top > 0 ? Math.round((r.count / top) * 100) : 0 }));
}

/** Reparto de la línea de tiempo por tipo de evento (qué clase de cosas pasan). */
export function eventKindTally(events: TraceabilityEvent[]): TraceabilityTally[] {
  return tally(events.map((e) => [e.kind, TRACE_EVENT_LABELS[e.kind]] as [string, string]));
}

/** Quién mueve el proyecto: número de eventos por persona que actúa. */
export function actorTally(events: TraceabilityEvent[]): TraceabilityTally[] {
  return tally(
    events.map((e) => [e.actor_name ?? "Sistema", e.actor_name ?? "Sistema"] as [string, string]),
  );
}

/** Tareas con más movimiento: dónde se concentra el historial (y los retrasos). */
export function busiestTasks(
  events: TraceabilityEvent[],
): { id: string; title: string; count: number; delays: number }[] {
  const byTask = new Map<string, { title: string; count: number; delays: number }>();
  for (const event of events) {
    const found = byTask.get(event.task_id) ?? { title: event.task_title, count: 0, delays: 0 };
    found.count += 1;
    if (event.is_delay) {
      found.delays += 1;
    }
    byTask.set(event.task_id, found);
  }
  return [...byTask.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.delays - a.delays || b.count - a.count)
    .slice(0, 6);
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
