import http from "@/lib/http";

export interface SendTestEmailPayload {
  to: string;
  subject?: string;
  html_body?: string;
}

export interface SendTestEmailResult {
  sent: boolean;
  provider: string;
  to: string;
  /** URLs que el servidor resolvió a partir de APP_PUBLIC_URL. */
  resolved_public_url: string;
  resolved_login_url: string;
  resolved_logo_url: string;
  /** El logo del correo respondió 2xx con content-type de imagen. */
  logo_reachable: boolean;
  logo_check_detail: string;
}

/** Plantillas que el developer puede disparar a mano. `welcome`/`overdue` son
 * solo lectura; `activation` MUTA la cuenta (emite un token nuevo y deja la
 * contraseña en blanco). */
export type ManualEmailKind = "welcome" | "overdue" | "activation";

export interface SendManualEmailsPayload {
  kind: ManualEmailKind;
  recipient_ids: string[];
}

export interface ManualEmailResult {
  user_id: string;
  email: string;
  name: string;
  /** Correos efectivamente enviados a esta persona. */
  sent: number;
  detail: string;
  /** Solo `activation`: si la persona ya había entrado antes de invalidarle la
   * contraseña. null para el resto de plantillas. */
  already_entered?: boolean | null;
}

export interface SendManualEmailsResult {
  kind: ManualEmailKind;
  results: ManualEmailResult[];
  total_sent: number;
}

/** Endpoint interno del developer para probar el envío de correo en producción. */
export const devEmailApi = {
  sendTest: (payload: SendTestEmailPayload) =>
    http.post<SendTestEmailResult>("/dev/email-test", payload).then((r) => r.data),
  sendManual: (payload: SendManualEmailsPayload) =>
    http.post<SendManualEmailsResult>("/dev/emails", payload).then((r) => r.data),
};
