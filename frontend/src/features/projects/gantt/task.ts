import type { Task } from "../types/api.types";

// El cronograma solo ubica tareas con inicio y fin; las tareas sin planificar
// (fechas en null) no tienen barra y se excluyen de la línea de tiempo.
export type DatedTask = Task & { start_date: string; due_date: string };
