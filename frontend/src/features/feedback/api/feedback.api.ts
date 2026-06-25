import http from "@/lib/http";
import type {
  CreateFeedbackPayload,
  FeedbackResponse,
  FeedbackStatus,
  PaginatedFeedback,
} from "../types";

// Cliente HTTP del feedback del sitio. Solo traduce a la API; sin lógica.
export const feedbackApi = {
  create: (payload: CreateFeedbackPayload) =>
    http.post<FeedbackResponse>("/feedback/", payload).then((r) => r.data),

  // Bandeja del developer (paginada).
  list: (page = 1, pageSize = 50) =>
    http
      .get<PaginatedFeedback>("/feedback/", { params: { page, page_size: pageSize } })
      .then((r) => r.data),

  updateStatus: (feedbackId: string, status: FeedbackStatus) =>
    http.patch<FeedbackResponse>(`/feedback/${feedbackId}/status`, { status }).then((r) => r.data),
};
