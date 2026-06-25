import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "../api/feedback.api";
import type { CreateFeedbackPayload, FeedbackStatus } from "../types";

const feedbackKeys = {
  all: ["feedback"] as const,
  list: () => [...feedbackKeys.all, "list"] as const,
};

/** Envía feedback del sitio. No hay lista cacheada que invalidar en el cliente. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: CreateFeedbackPayload) => feedbackApi.create(payload),
  });
}

/** Bandeja de feedback (developer). */
export function useFeedbackList() {
  return useQuery({
    queryKey: feedbackKeys.list(),
    queryFn: () => feedbackApi.list(),
  });
}

/** Cambia el estado de un feedback e invalida la bandeja. */
export function useUpdateFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: FeedbackStatus }) =>
      feedbackApi.updateStatus(vars.id, vars.status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: feedbackKeys.all });
    },
  });
}
