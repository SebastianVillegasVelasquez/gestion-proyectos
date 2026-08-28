import type { Task, TaskStatus } from "../types/api.types";
import { TASK_STATUS_LABELS } from "../types/labels";
import { taskRisk } from "./task-dates";

/** Lo mínimo que necesita el tablero de una tarea (sirve para `Task` del
 * proyecto y para `ApiTeamTask` del workspace, misma forma). */
export type BoardTask = Pick<Task, "status" | "due_date">;

export interface BoardColumn<T extends BoardTask = BoardTask> {
  key: TaskStatus | "en_riesgo";
  label: string;
  /** `true` solo en la lane de riesgo: la vista la tiñe de rojo. */
  atRisk: boolean;
  tasks: T[];
}

/** Recorrido real de una tarea, de izquierda a derecha en el tablero. */
const STATUS_FLOW: TaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
];

/**
 * Reparte las tareas de un equipo en columnas de tablero.
 *
 * Las tareas ABIERTAS en riesgo (vencidas o por vencer, según `taskRisk`) se
 * sacan de su columna de estado y se agrupan en una lane «En riesgo» al frente:
 * es una cola de triaje, así que cada tarea aparece una sola vez. Las columnas
 * de estado se devuelven siempre —aunque vacías— para que el tablero no cambie
 * de ancho; «Cancelada» solo aparece si hay alguna.
 */
export function buildTeamBoard<T extends BoardTask>(tasks: T[], today: string): BoardColumn<T>[] {
  const risk: T[] = [];
  const cancelled: T[] = [];
  const byStatus = new Map<TaskStatus, T[]>(STATUS_FLOW.map((s) => [s, []]));

  for (const task of tasks) {
    if (task.status === "cancelada") {
      cancelled.push(task);
    } else if (taskRisk(task, today) !== null) {
      risk.push(task);
    } else {
      byStatus.get(task.status)?.push(task);
    }
  }

  const columns: BoardColumn<T>[] = [
    { key: "en_riesgo", label: "En riesgo", atRisk: true, tasks: risk },
    ...STATUS_FLOW.map((status) => ({
      key: status,
      label: TASK_STATUS_LABELS[status],
      atRisk: false,
      tasks: byStatus.get(status) ?? [],
    })),
  ];
  if (cancelled.length > 0) {
    columns.push({
      key: "cancelada",
      label: TASK_STATUS_LABELS.cancelada,
      atRisk: false,
      tasks: cancelled,
    });
  }
  return columns;
}
