// Contrato del feedback del sitio (coincide con el backend FastAPI).
// Los valores del enum son los que serializa Pydantic (minúscula).

export type FeedbackType =
  | "positivo"
  | "negativo"
  | "nueva_funcionalidad"
  | "nice_to_have"
  | "otro";

export interface FeedbackOption {
  value: FeedbackType;
  label: string;
  hint: string;
}

// Orden y textos de las categorías que ve el usuario en el widget.
export const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { value: "positivo", label: "Me gusta", hint: "Algo que funciona bien" },
  { value: "negativo", label: "Hay un problema", hint: "Un error o algo que falla" },
  { value: "nueva_funcionalidad", label: "Nueva idea", hint: "Una funcionalidad que falta" },
  { value: "nice_to_have", label: "Estaría bien", hint: "Mejora deseable, no urgente" },
  { value: "otro", label: "Otro", hint: "Cualquier otro comentario" },
];

export type FeedbackStatus = "pendiente" | "realizado" | "imposible" | "mas_tarde" | "descartado";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  pendiente: "Pendiente",
  realizado: "Realizado",
  imposible: "Imposible",
  mas_tarde: "Más tarde",
  descartado: "Descartado",
};

// Acento por estado (mismo lenguaje visual que TASK_STATUS_COLORS).
export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  pendiente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  realizado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  imposible: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  mas_tarde: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  descartado: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
};

export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  "pendiente",
  "realizado",
  "mas_tarde",
  "imposible",
  "descartado",
];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  positivo: "Me gusta",
  negativo: "Problema",
  nueva_funcionalidad: "Nueva idea",
  nice_to_have: "Estaría bien",
  otro: "Otro",
};

export interface CreateFeedbackPayload {
  feedback_type: FeedbackType;
  message: string;
  page?: string | null;
}

export interface FeedbackResponse {
  id: string;
  feedback_type: FeedbackType;
  status: FeedbackStatus;
  message: string;
  page: string | null;
  user_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface PaginatedFeedback {
  items: FeedbackResponse[];
  total: number;
  page: number;
  page_size: number;
}
