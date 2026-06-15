import type { NodeType, ProjectRole, TaskPriority, TaskStatus } from "./api.types";

// "Líder" del proyecto = coordinador en el backend. El orden define el orden de
// las secciones del equipo (líder primero).
export const PROJECT_ROLE_ORDER: ProjectRole[] = [
  "coordinador",
  "supervisor",
  "revisor",
  "integrante",
  "cliente",
];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  coordinador: "Líder",
  supervisor: "Supervisor",
  revisor: "Revisor",
  integrante: "Integrante",
  cliente: "Cliente",
};

export const PROJECT_ROLE_ACCENT: Record<ProjectRole, string> = {
  coordinador: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  supervisor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  revisor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  integrante: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cliente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  PROGRAMA: "Programa",
  CURSO: "Curso",
  MODULO: "Módulo",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente_por_iniciar: "Pendiente",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  devuelta: "Devuelta",
  completada: "Completada",
  cancelada: "Cancelada",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pendiente_por_iniciar: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  en_progreso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  en_revision: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  devuelta: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelada: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  no_definida: "Sin definir",
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

/** Etiqueta visible del nodo: usa el label flexible si existe, si no el del tipo. */
export function nodeDisplayType(node: { node_type: NodeType; type_label: string | null }): string {
  return node.type_label?.trim() ? node.type_label : NODE_TYPE_LABELS[node.node_type];
}
