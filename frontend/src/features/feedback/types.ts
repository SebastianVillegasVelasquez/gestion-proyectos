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

export interface CreateFeedbackPayload {
  feedback_type: FeedbackType;
  message: string;
  page?: string | null;
}

export interface FeedbackResponse {
  id: string;
  feedback_type: FeedbackType;
  message: string;
  page: string | null;
  user_id: string | null;
  author_name: string | null;
  created_at: string;
}
