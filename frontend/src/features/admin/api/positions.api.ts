import http from "@/lib/http";

/** Opción de cargo servida por GET /identity/positions (fuente de verdad: backend). */
export interface PositionOption {
  value: string;
  label: string;
}

/**
 * Alta de un cargo: quien lo crea solo escribe el nombre tal cual se lee
 * ("Diseñador Gráfico"). La clave estable (`value`) la deriva el backend, así
 * que la UI no le pide al administrador un dato técnico que no le aporta nada.
 */
export interface CreatePositionPayload {
  label: string;
}

export const positionsApi = {
  list: () => http.get<PositionOption[]>("/identity/positions").then((r) => r.data),

  create: (payload: CreatePositionPayload) =>
    http.post<PositionOption>("/identity/positions", payload).then((r) => r.data),
};
