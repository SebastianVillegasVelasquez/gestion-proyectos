import { useMutation } from "@tanstack/react-query";
import { feedbackApi } from "../api/feedback.api";
import type { CreateFeedbackPayload } from "../types";

/** Envía feedback del sitio. No hay lista cacheada que invalidar en el cliente. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: CreateFeedbackPayload) => feedbackApi.create(payload),
  });
}
