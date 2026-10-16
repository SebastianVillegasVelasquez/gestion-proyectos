import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { refreshAccessToken } from "@/features/auth/api/refresh";
import type * as RefreshModule from "@/features/auth/api/refresh";

vi.mock("@/features/auth/api/refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof RefreshModule>();
  return { ...actual, refreshAccessToken: vi.fn() };
});

vi.mock("@/features/auth/api/revalidate", () => ({
  USER_REVALIDATED_EVENT: "auth:user-revalidated",
  revalidateUser: vi.fn(() => Promise.resolve()),
}));

function jwt(secondsFromNow: number): string {
  const b64 = (o: unknown): string => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({ sub: "u1", role: "admin", exp: Math.floor(Date.now() / 1000) + secondsFromNow }),
    "firma-de-prueba",
  ].join(".");
}

const USER = { id: "u1", name: "Ana", email: "ana@test.com", role: "admin" };

/** Pinta el estado del contexto para poder afirmar sobre él sin montar rutas. */
function Probe() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  return (
    <ul>
      <li>bootstrapping: {String(isBootstrapping)}</li>
      <li>authenticated: {String(isAuthenticated)}</li>
      <li>user: {user?.name ?? "ninguno"}</li>
    </ul>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const state = (label: string) => screen.getByText(new RegExp(`^${label}:`)).textContent;

describe("AuthProvider al arrancar", () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
    localStorage.clear();
  });

  it("sin nada guardado: no espera, va directo a no autenticado", () => {
    renderProvider();

    expect(state("bootstrapping")).toBe("bootstrapping: false");
    expect(state("authenticated")).toBe("authenticated: false");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("con token vigente: no espera, entra de una", () => {
    localStorage.setItem("access_token", jwt(3600));
    localStorage.setItem("auth_user", JSON.stringify(USER));

    renderProvider();

    expect(state("bootstrapping")).toBe("bootstrapping: false");
    expect(state("authenticated")).toBe("authenticated: true");
    expect(state("user")).toBe("user: Ana");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("token vencido + refresh token vivo: espera y entra, sin pasar por el login", async () => {
    // Este es el caso del bug: antes el primer render decía «no autenticado» y
    // el ProtectedRoute mandaba al login aunque la renovación iba a funcionar.
    localStorage.setItem("access_token", jwt(-60));
    localStorage.setItem("auth_user", JSON.stringify(USER));
    localStorage.setItem("refresh_token", "refresh-vivo");
    vi.mocked(refreshAccessToken).mockImplementation(() => {
      localStorage.setItem("access_token", jwt(3600));
      return Promise.resolve("token-nuevo");
    });

    renderProvider();

    // Primer render: esperando, y NO autenticado todavía.
    expect(state("bootstrapping")).toBe("bootstrapping: true");
    expect(state("authenticated")).toBe("authenticated: false");

    await waitFor(() => {
      expect(state("bootstrapping")).toBe("bootstrapping: false");
    });
    expect(state("authenticated")).toBe("authenticated: true");
    expect(state("user")).toBe("user: Ana");
  });

  it("token vencido + refresh token muerto: espera y acaba en no autenticado", async () => {
    localStorage.setItem("access_token", jwt(-60));
    localStorage.setItem("auth_user", JSON.stringify(USER));
    localStorage.setItem("refresh_token", "refresh-muerto");
    vi.mocked(refreshAccessToken).mockResolvedValue(null);

    renderProvider();

    expect(state("bootstrapping")).toBe("bootstrapping: true");

    await waitFor(() => {
      expect(state("bootstrapping")).toBe("bootstrapping: false");
    });
    expect(state("authenticated")).toBe("authenticated: false");
  });

  it("no se queda colgada si la renovación nunca contesta", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem("access_token", jwt(-60));
      localStorage.setItem("auth_user", JSON.stringify(USER));
      localStorage.setItem("refresh_token", "refresh-que-no-responde");
      vi.mocked(refreshAccessToken).mockReturnValue(new Promise(() => undefined));

      renderProvider();
      expect(state("bootstrapping")).toBe("bootstrapping: true");

      // El `setTimeout` del arranque cambia estado: hay que dejar a React
      // procesarlo antes de mirar lo pintado.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });

      expect(state("bootstrapping")).toBe("bootstrapping: false");
      expect(state("authenticated")).toBe("authenticated: false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("deja de considerar la sesión viva cuando la renovación falla en caliente", async () => {
    localStorage.setItem("access_token", jwt(3600));
    localStorage.setItem("auth_user", JSON.stringify(USER));
    renderProvider();
    expect(state("authenticated")).toBe("authenticated: true");

    // Lo que hace `refreshAccessToken` al fallar: limpia y avisa.
    localStorage.clear();
    window.dispatchEvent(new Event("auth:ended"));

    await waitFor(() => {
      expect(state("authenticated")).toBe("authenticated: false");
    });
  });
});
