import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import http from "./http";
import { refreshAccessToken } from "@/features/auth/api/refresh";
import type * as RefreshModule from "@/features/auth/api/refresh";
import { PREVIEW_READ_ONLY_MESSAGE } from "@/features/auth/utils/view-as";

vi.mock("@/features/auth/api/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof RefreshModule>();
  return { ...actual, refreshAccessToken: vi.fn() };
});

/**
 * JWT sin firmar: el frontend solo descodifica el payload con `atob` para leer
 * `exp` (ver `jwt.utils.ts`), así que la firma es irrelevante aquí y no hace
 * falta una librería de criptografía en los tests.
 */
function jwtExpiringIn(seconds: number): string {
  const payload = { sub: "u1", role: "admin", exp: Math.floor(Date.now() / 1000) + seconds };
  const b64 = (o: unknown): string => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.firma-de-prueba`;
}

interface Reply {
  status: number;
  data?: unknown;
}

/** Respuestas encoladas por `MÉTODO /url`; la última se repite al agotarse. */
let replies: Record<string, Reply[]>;
let sent: AxiosRequestConfig[];

function queue(route: string, ...r: Reply[]): void {
  replies[route] = r;
}

function nextReply(route: string): Reply {
  const queued = replies[route] as Reply[] | undefined;
  if (!queued || queued.length === 0) {
    throw new Error(`Ninguna respuesta encolada para ${route}`);
  }
  return queued.length > 1 ? queued.shift()! : queued[0];
}

// Adaptador propio en lugar de axios-mock-adapter: no añade dependencias y deja
// ver exactamente qué peticiones SALIERON de verdad (`sent`), que es justo lo
// que hay que comprobar del interceptor de petición.
http.defaults.adapter = (config: AxiosRequestConfig): Promise<AxiosResponse> => {
  sent.push(config);
  const method = (config.method ?? "get").toUpperCase();
  const { status, data } = nextReply(`${method} ${config.url ?? ""}`);
  const response = {
    data: data ?? {},
    status,
    statusText: String(status),
    headers: {},
    config,
  } as AxiosResponse;
  if (status >= 200 && status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(
    Object.assign(new Error(`Request failed with status code ${String(status)}`), {
      isAxiosError: true,
      config,
      response,
    }),
  );
};

describe("http interceptors", () => {
  beforeEach(() => {
    replies = {};
    sent = [];
    sessionStorage.clear();
    vi.mocked(refreshAccessToken).mockReset();
    localStorage.clear();
  });

  describe("token vigente", () => {
    it("attaches it and never renews", async () => {
      const token = jwtExpiringIn(3600);
      localStorage.setItem("access_token", token);
      queue("GET /identity/me", { status: 200, data: { id: "u1" } });

      const res = await http.get("/identity/me");

      expect(res.status).toBe(200);
      expect(sent[0].headers?.Authorization).toBe(`Bearer ${token}`);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("token ya vencido (el bug P0)", () => {
    it("renews BEFORE sending, so no request goes out condemned", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(-60));
      vi.mocked(refreshAccessToken).mockResolvedValue("token-nuevo");
      queue("GET /identity/me", { status: 200 });

      await http.get("/identity/me");

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(sent).toHaveLength(1);
      expect(sent[0].headers?.Authorization).toBe("Bearer token-nuevo");
    });

    it("treats a token inside the 30s skew as already expired", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(10));
      vi.mocked(refreshAccessToken).mockResolvedValue("token-nuevo");
      queue("GET /identity/me", { status: 200 });

      await http.get("/identity/me");

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("fails fast without spending a request when renewal fails", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(-60));
      vi.mocked(refreshAccessToken).mockResolvedValue(null);

      await expect(http.get("/identity/me")).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(sent).toHaveLength(0);
      // Una sola vez: el rechazo del interceptor de petición no debe volver a
      // caer en el camino de renovación del de respuesta.
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("leaves an opaque token alone instead of renewing in a loop", async () => {
      // Sin `exp` legible no hay nada que renovar por adelantado: lo decide el
      // servidor. Si contara como vencido, cada petición pediría un token nuevo.
      localStorage.setItem("access_token", "no-es-un-jwt");
      queue("GET /identity/me", { status: 200 });

      await http.get("/identity/me");

      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(sent[0].headers?.Authorization).toBe("Bearer no-es-un-jwt");
    });

    it("does not renew on the session endpoints themselves", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(-60));
      queue("POST /identity/auth/refresh", { status: 200 });

      await http.post("/identity/auth/refresh", {});

      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("401 de respuesta", () => {
    it("renews and retries the original request once", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(3600));
      // Como la función real: persiste el token nuevo. El reintento vuelve a
      // pasar por el interceptor de petición, que lo lee de ahí.
      vi.mocked(refreshAccessToken).mockImplementation(() => {
        localStorage.setItem("access_token", "token-nuevo");
        return Promise.resolve("token-nuevo");
      });
      queue(
        "GET /projects",
        { status: 401, data: { detail: "Token inválido o expirado" } },
        { status: 200, data: [{ id: "p1" }] },
      );

      const res = await http.get("/projects");

      expect(res.status).toBe(200);
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(sent).toHaveLength(2);
      expect(sent[1].headers?.Authorization).toBe("Bearer token-nuevo");
    });

    it("retries only once, so a backend stuck on 401 cannot loop", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(3600));
      vi.mocked(refreshAccessToken).mockResolvedValue("token-nuevo");
      queue("GET /projects", { status: 401 });

      await expect(http.get("/projects")).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(sent).toHaveLength(2);
    });

    it("clears the session when renewal fails", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(3600));
      localStorage.setItem("auth_user", JSON.stringify({ id: "u1" }));
      vi.mocked(refreshAccessToken).mockResolvedValue(null);
      queue("GET /projects", { status: 401 });

      await expect(http.get("/projects")).rejects.toBeTruthy();

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("auth_user")).toBeNull();
    });

    it("leaves a failed login alone — the form shows the error itself", async () => {
      queue("POST /identity/auth/login", {
        status: 401,
        data: { detail: "Credenciales incorrectas" },
      });

      await expect(http.post("/identity/auth/login", {})).rejects.toMatchObject({
        response: { data: { detail: "Credenciales incorrectas" } },
      });
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("403 de autorización", () => {
    it("propagates untouched and never touches the session", async () => {
      const token = jwtExpiringIn(3600);
      localStorage.setItem("access_token", token);
      queue("GET /identity/users/manage", { status: 403, data: { detail: "No tienes permiso" } });

      await expect(http.get("/identity/users/manage")).rejects.toMatchObject({
        response: { status: 403 },
      });
      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(localStorage.getItem("access_token")).toBe(token);
    });
  });

  describe("vista previa de otro rol", () => {
    it("blocks writes before they leave the browser", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(3600));
      sessionStorage.setItem("view_as_role", "user");

      await expect(http.post("/projects", {})).rejects.toMatchObject({
        response: { status: 403, data: { detail: PREVIEW_READ_ONLY_MESSAGE } },
      });
      expect(sent).toHaveLength(0);
    });

    it("still allows reads", async () => {
      localStorage.setItem("access_token", jwtExpiringIn(3600));
      sessionStorage.setItem("view_as_role", "user");
      queue("GET /projects", { status: 200, data: [] });

      await expect(http.get("/projects")).resolves.toMatchObject({ status: 200 });
    });
  });
});
