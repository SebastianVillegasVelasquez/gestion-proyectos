import type { TaskStatus } from "@/features/projects/types/api.types";

/** Estados en los que su responsable puede declarar avance (espejo de la regla
 *  del servidor, que además bloquea las tareas con subtareas y lo explica en el
 *  propio diálogo). */
const EDITABLE: ReadonlySet<TaskStatus> = new Set<TaskStatus>(["en_progreso", "devuelta"]);

export function canOfferProgressEdit(status: TaskStatus, isOwner: boolean): boolean {
  return isOwner && EDITABLE.has(status);
}
