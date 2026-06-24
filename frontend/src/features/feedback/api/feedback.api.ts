import http from "@/lib/http";
import type { CreateFeedbackPayload, FeedbackResponse } from "../types";

// Cliente HTTP del feedback del sitio. Solo traduce a la API; sin lógica.
export const feedbackApi = {
  create: (payload: CreateFeedbackPayload) =>
    http.post<FeedbackResponse>("/feedback/", payload).then((r) => r.data),
};
