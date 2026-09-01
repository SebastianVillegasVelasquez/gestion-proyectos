import { useMutation } from "@tanstack/react-query";
import { devEmailApi, type SendTestEmailPayload } from "../api/dev-email.api";

/** Dispara un correo de prueba (solo developer). No cachea nada: es una acción. */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: (payload: SendTestEmailPayload) => devEmailApi.sendTest(payload),
  });
}
