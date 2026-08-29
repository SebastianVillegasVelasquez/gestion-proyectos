import { describe, it, expect, vi, beforeEach } from "vitest";

// `http` es el cliente axios con interceptores; aquí solo nos interesa `.get`.
vi.mock("@/lib/http", () => ({ default: { get: vi.fn() } }));

import http from "@/lib/http";

const getMock = vi.mocked(http.get);

/** JWT de mentira con `exp` en el futuro para que `readSession` lo dé por válido. */
function fakeToken(expSeconds = Math.floor(Date.now() / 1000) + 3600): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp: expSeconds })}.sig`;
}

const USER = {
  id: "u1",
  name: "Ana",
  email: "ana@obj.com",
  role: "user" as const,
  position: "desarrollador",
};

function seedSession(user = USER) {
  localStorage.setItem("access_token", fakeToken());
  localStorage.setItem("refresh_token", "r1");
  localStorage.setItem("auth_user", JSON.stringify(user));
}

async function loadModule() {
  // Estado de throttle/single-flight vive a nivel de módulo: recargamos por test.
  vi.resetModules();
  return import("./revalidate");
}

describe("revalidateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("no hace nada si no hay sesión", async () => {
    const { revalidateUser } = await loadModule();
    await revalidateUser(true);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("no reescribe la sesión si el usuario no cambió", async () => {
    seedSession();
    getMock.mockResolvedValue({ data: { ...USER } });
    const { revalidateUser, USER_REVALIDATED_EVENT } = await loadModule();
    const listener = vi.fn();
    window.addEventListener(USER_REVALIDATED_EVENT, listener);

    await revalidateUser(true);

    expect(getMock).toHaveBeenCalledWith("/identity/me");
    expect(JSON.parse(localStorage.getItem("auth_user")!).role).toBe("user");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(USER_REVALIDATED_EVENT, listener);
  });

  it("actualiza auth_user y emite evento cuando cambió el rol", async () => {
    seedSession();
    getMock.mockResolvedValue({ data: { ...USER, role: "admin" } });
    const { revalidateUser, USER_REVALIDATED_EVENT } = await loadModule();
    const listener = vi.fn();
    window.addEventListener(USER_REVALIDATED_EVENT, listener);

    await revalidateUser(true);

    expect(JSON.parse(localStorage.getItem("auth_user")!).role).toBe("admin");
    expect(localStorage.getItem("access_token")).toBe(fakeToken()); // token intacto
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(USER_REVALIDATED_EVENT, listener);
  });

  it("no toca la sesión si /identity/me falla", async () => {
    seedSession();
    getMock.mockRejectedValue(new Error("network"));
    const { revalidateUser } = await loadModule();

    await revalidateUser(true);

    expect(JSON.parse(localStorage.getItem("auth_user")!).role).toBe("user");
    expect(localStorage.getItem("access_token")).not.toBeNull();
  });

  it("aplica un intervalo mínimo entre llamadas no forzadas", async () => {
    seedSession();
    getMock.mockResolvedValue({ data: { ...USER } });
    const { revalidateUser } = await loadModule();

    await revalidateUser(true); // primera, forzada
    await revalidateUser(); // dentro del intervalo -> se ignora
    await revalidateUser();

    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
