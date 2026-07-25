import http from "@/lib/http";

/** Opción de cargo servida por GET /identity/positions (fuente de verdad: backend). */
export interface PositionOption {
  value: string;
  label: string;
}

export interface CreatePositionPayload {
  key: string;
  label: string;
}

export const positionsApi = {
  list: () => http.get<PositionOption[]>("/identity/positions").then((r) => r.data),

  create: (payload: CreatePositionPayload) =>
    http.post<PositionOption>("/identity/positions", payload).then((r) => r.data),
};
