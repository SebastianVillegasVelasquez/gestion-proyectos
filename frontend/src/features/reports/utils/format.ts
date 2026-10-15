import { TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import type { TaskStatus } from "@/features/projects/types/api.types";

export const statusLabel = (s: string) => TASK_STATUS_LABELS[s as TaskStatus] ?? s;
export const bdays = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`;
export const path = (p: string[]) => (p.length ? p.join(" › ") : "Sin ubicar");
