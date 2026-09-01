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
}

/** Endpoint interno del developer para probar el envío de correo en producción. */
export const devEmailApi = {
  sendTest: (payload: SendTestEmailPayload) =>
    http.post<SendTestEmailResult>("/dev/email-test", payload).then((r) => r.data),
};
