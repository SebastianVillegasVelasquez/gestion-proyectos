import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { readSession } from "@/features/auth/utils/session.utils";

const WS_URL = import.meta.env.VITE_WS_URL as string;
const MAX_BACKOFF_MS = 30_000;

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

      const ws = new WebSocket(`${WS_URL}?token=${session.accessToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
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
        if (evt.code === 4401) {
          return;
        } // token inválido → no insistir

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
