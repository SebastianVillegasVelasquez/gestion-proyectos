import axios, { type InternalAxiosRequestConfig } from "axios";
import { clearSession } from "@/features/auth/utils/session.utils";
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

http.interceptors.request.use((config) => {
  // Vista previa de otro rol = solo lectura: se corta cualquier escritura antes
  // de que salga (el cierre de sesión y la renovación del token siguen libres).
  const url = config.url ?? "";
  const isAuth = url.includes("/auth/");
  if (isPreviewing() && !READ_METHODS.has((config.method ?? "get").toLowerCase()) && !isAuth) {
    return Promise.reject(
      Object.assign(new Error(PREVIEW_READ_ONLY_MESSAGE), {
        response: { status: 403, data: { detail: PREVIEW_READ_ONLY_MESSAGE } },
      }),
    );
  }
  const token = localStorage.getItem("access_token");
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
    // reintentamos la petición original una sola vez.
    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
      clearSession();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default http;
