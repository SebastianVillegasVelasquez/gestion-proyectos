import axios, { type InternalAxiosRequestConfig } from "axios";
import { clearSession } from "@/features/auth/utils/session.utils";
import { isKnownExpired } from "@/features/auth/utils/jwt.utils";
import { refreshAccessToken } from "@/features/auth/api/refresh";
import { PREVIEW_READ_ONLY_MESSAGE, isPreviewing } from "@/features/auth/utils/view-as";

// Cliente HTTP compartido por toda la app (infraestructura, no de un feature).
// Centraliza baseURL, token de acceso y el refresco automático ante un 401.
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

const READ_METHODS = new Set(["get", "head", "options"]);

/** Las rutas de sesión (login, refresh, logout) nunca llevan token renovado:
 *  renovarlo aquí sería morderse la cola (el propio refresh dispararía otro). */
function isSessionEndpoint(url: string): boolean {
  return url.includes("/auth/");
}

http.interceptors.request.use(async (config) => {
  // Vista previa de otro rol = solo lectura: se corta cualquier escritura antes
  // de que salga (el cierre de sesión y la renovación del token siguen libres).
  const url = config.url ?? "";
  const isAuth = isSessionEndpoint(url);
  if (isPreviewing() && !READ_METHODS.has((config.method ?? "get").toLowerCase()) && !isAuth) {
    return Promise.reject(
      Object.assign(new Error(PREVIEW_READ_ONLY_MESSAGE), {
        response: { status: 403, data: { detail: PREVIEW_READ_ONLY_MESSAGE } },
      }),
    );
  }

  let token = localStorage.getItem("access_token");

  // Un token ya vencido NO sale del navegador: lo renovamos antes de enviar.
  // El temporizador del AuthContext renueva en circunstancias normales, pero es
  // un setTimeout: si la pestaña estuvo en segundo plano o el equipo suspendido,
  // no salta a tiempo y el token caduca donde está. Sin esto, la petición viaja
  // condenada y la pantalla se queda sin datos esperando un 401 que resolver.
  if (token && !isAuth && isKnownExpired(token)) {
    token = await refreshAccessToken();
    if (!token) {
      // El refresh token también caducó: la sesión está cerrada (lo hace
      // `refreshAccessToken`). Cortamos aquí en vez de gastar una petición
      // que ya sabemos que va a volver 401. `_retry` va marcado porque el
      // rechazo de un interceptor de petición igual atraviesa el manejador de
      // error del de respuesta: sin la marca, volvería a intentar renovar.
      return Promise.reject(
        Object.assign(new Error("La sesión expiró"), {
          config: Object.assign(config, { _retry: true }),
          response: { status: 401, data: { detail: "La sesión expiró" } },
        }),
      );
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status as number | undefined;
    const url = original?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/refresh") || url.includes("/auth/login");

    // Token de acceso vencido: intentamos renovarlo con el refresh token y
    // reintentamos la petición original una sola vez. El backend responde 401
    // en TODO fallo de autenticación (token inválido/vencido, cuenta borrada o
    // desactivada); el 403 es de autorización y no se toca la sesión por él.
    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      // El reintento vuelve a pasar por el interceptor de petición, que lee el
      // token renovado del storage: no hace falta ponerlo a mano en la cabecera.
      if (await refreshAccessToken()) {
        return http(original);
      }
      // Sesión cerrada: `refreshAccessToken` ya limpió el storage y avisó al
      // AuthContext, que deja `isAuthenticated` en false y hace que el
      // ProtectedRoute lleve al login. Antes esto era un
      // `window.location.href`, que recargaba la app entera y perdía la ruta
      // de origen.
      clearSession();
    }

    return Promise.reject(error);
  },
);

export default http;
