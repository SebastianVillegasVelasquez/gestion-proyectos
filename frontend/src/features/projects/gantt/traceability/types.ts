import type { TaskStatus } from "../types";

export type HistoryAction = "creacion" | "cambio_estado" | "reasignacion" | "comentario";

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  creacion: "Creación",
  cambio_estado: "Cambio de estado",
  reasignacion: "Reasignación",
  comentario: "Comentario",
};

export const HISTORY_ACTION_OPTIONS: { value: HistoryAction; label: string }[] = (
  Object.keys(HISTORY_ACTION_LABELS) as HistoryAction[]
).map((v) => ({
  value: v,
  label: HISTORY_ACTION_LABELS[v],
}));

export interface TaskHistory {
  id: string;
  task_id: string;
  changed_by_id: string;
  action: HistoryAction;
  old_status: TaskStatus | null;
  new_status: TaskStatus | null;
  change_reason: string;
  created_at: string; // ISO timestamp
}
