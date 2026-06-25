import type { TraceabilityEvent, TraceabilityEventKind } from "@/features/projects/types/api.types";

// Etiqueta legible por tipo de evento (presentación de la línea de tiempo).
export const TRACE_EVENT_LABELS: Record<TraceabilityEventKind, string> = {
  creacion: "Tarea creada",
  asignacion: "Responsable asignado",
  inicio: "Inicio de ejecución",
  entrega: "Entrega a revisión",
  aprobacion: "Entrega aprobada",
  devolucion: "Tarea devuelta",
  cancelacion: "Tarea cancelada",
  comentario: "Comentario",
  cambio_estado: "Cambio de estado",
};

/**
 * Filtra la línea de tiempo. Con `onlyDelays` deja solo los eventos marcados
 * como retraso (los que atrasan el proyecto). Función pura: fácil de testear.
 */
export function filterTraceabilityEvents(
  events: TraceabilityEvent[],
  onlyDelays: boolean,
): TraceabilityEvent[] {
  if (!onlyDelays) {
    return events;
  }
  return events.filter((e) => e.is_delay);
}
