import { useMutation } from "@tanstack/react-query";
import {
  devEmailApi,
  type SendManualEmailsPayload,
  type SendTestEmailPayload,
} from "../api/dev-email.api";

/** Dispara un correo de prueba (solo developer). No cachea nada: es una acción. */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: (payload: SendTestEmailPayload) => devEmailApi.sendTest(payload),
  });
}

/** Envía a mano una plantilla real (bienvenida / tarea vencida) a una o varias
 * personas. Solo developer. */
export function useSendManualEmails() {
  return useMutation({
    mutationFn: (payload: SendManualEmailsPayload) => devEmailApi.sendManual(payload),
  });
}
