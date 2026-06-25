import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { usePositions } from "./use-positions";
import { authApi } from "../api/auth.api";

// Comportamiento nuevo: la carga de cargos es perezosa. En el login no debe
// pedirse hasta que el usuario abre el registro (enabled = isRegister).
vi.mock("../api/auth.api", () => ({
  authApi: { positions: vi.fn() },
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("usePositions (lazy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the API while disabled (login screen)", async () => {
    const { result } = renderHook(() => usePositions(false), { wrapper: makeWrapper() });

    // La query queda inactiva: no se dispara la petición.
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(authApi.positions).not.toHaveBeenCalled();
  });

  it("calls the API once enabled (register screen)", async () => {
    vi.mocked(authApi.positions).mockResolvedValue([{ value: "sin_cargo", label: "Sin cargo" }]);

    const { result } = renderHook(() => usePositions(true), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(authApi.positions).toHaveBeenCalledTimes(1);
  });
});
