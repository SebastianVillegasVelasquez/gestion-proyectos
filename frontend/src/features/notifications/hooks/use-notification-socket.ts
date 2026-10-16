import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { readSession } from "@/features/auth/utils/session.utils";
import { refreshAccessToken } from "@/features/auth/api/refresh";

const WS_URL_ENV = import.meta.env.VITE_WS_URL as string | undefined;
const MAX_BACKOFF_MS = 30_000;

/**
 * Construye la URL del WebSocket de forma segura para dev y producción:
 * - Si `VITE_WS_URL` es una URL absoluta (empieza con `ws://` o `wss://`), se
 *   usa tal cual — útil en dev cuando el backend vive en otro origen.
 * - Si no, se construye a partir del origen actual (`location`) para que en
 *   producción el navegador hable con el mismo host que sirvió la SPA
 *   (nginx hace el proxy con Upgrade). Escoge `wss://` automáticamente cuando
 *   la app se sirve por HTTPS: mezclar `ws://` en una página HTTPS lo bloquea
 *   el navegador.
 */
function resolveWsUrl(): string {
  const path = "/api/v1/ws/notifications";
  if (WS_URL_ENV && /^wss?:\/\//i.test(WS_URL_ENV)) {
    return WS_URL_ENV;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_URL_ENV ?? path}`;
}

/**
 * Mantiene una conexión WebSocket con /ws/notifications mientras el usuario
 * esté autenticado. Al recibir un evento, invalida el cache de React Query
 * para que la campanita se refresque.
 *
 * Se monta una sola vez (típicamente en AppLayout). No devuelve nada.
 */
export function useNotificationsSocket(): void {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  // Una sola renovación por token rechazado: si el servidor sigue diciendo que
  // no con un token recién emitido, el problema no es la caducidad y reintentar
  // solo haría girar la rueda.
  const renewedForAuthRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    isUnmountedRef.current = false;

    const connect = () => {
      // Leemos el token justo antes de abrir la WS para agarrar
      // siempre el más reciente (por si acaba de refrescarse).
      const session = readSession();
      if (!session?.accessToken) {
        return;
      }

      const ws = new WebSocket(`${resolveWsUrl()}?token=${session.accessToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        renewedForAuthRef.current = false;
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data as string) as { type?: string };
          if (payload.type === "notification.new") {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        } catch {
          // mensaje mal formado — ignoramos
        }
      };

      ws.onclose = (evt) => {
        wsRef.current = null;

        if (isUnmountedRef.current) {
          return;
        }
        // 4401 = el servidor rechazó el token. Lo normal es que simplemente
        // haya caducado (vive una hora): se renueva y se vuelve a conectar. Sin
        // esto, la campanita se quedaba muda el resto de la sesión, en silencio
        // y sin que nada lo delatara, porque las dependencias del efecto no
        // cambian cuando se renueva el token.
        if (evt.code === 4401) {
          if (renewedForAuthRef.current) {
            return;
          }
          renewedForAuthRef.current = true;
          void refreshAccessToken().then((token) => {
            if (token && !isUnmountedRef.current) {
              connect();
            }
          });
          return;
        }

        const attempt = reconnectAttemptsRef.current;
        const delay = Math.min(2 ** attempt * 1000, MAX_BACKOFF_MS);
        reconnectAttemptsRef.current = attempt + 1;

        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose se dispara justo después — allí manejamos la reconexión.
      };
    };

    connect();

    return () => {
      isUnmountedRef.current = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      wsRef.current?.close();
      wsRef.current = null;

      reconnectAttemptsRef.current = 0;
    };
  }, [user?.id, isAuthenticated, queryClient]);
}
