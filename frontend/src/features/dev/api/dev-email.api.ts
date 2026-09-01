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

/** Endpoint interno del developer para probar el envío de correo en producción. */
export const devEmailApi = {
  sendTest: (payload: SendTestEmailPayload) =>
    http.post<SendTestEmailResult>("/dev/email-test", payload).then((r) => r.data),
};
