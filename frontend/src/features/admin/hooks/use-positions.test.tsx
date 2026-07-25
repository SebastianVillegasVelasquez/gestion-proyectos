import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { usePositions } from "./use-positions";
import { positionsApi } from "../api/positions.api";

vi.mock("../api/positions.api", () => ({
  positionsApi: { list: vi.fn(), create: vi.fn() },
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("usePositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the API while disabled", async () => {
    const { result } = renderHook(() => usePositions(false), { wrapper: makeWrapper() });

    // La query queda inactiva: no se dispara la petición.
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(positionsApi.list).not.toHaveBeenCalled();
  });

  it("calls the API once enabled", async () => {
    vi.mocked(positionsApi.list).mockResolvedValue([{ value: "sin_cargo", label: "Sin cargo" }]);

    const { result } = renderHook(() => usePositions(true), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(positionsApi.list).toHaveBeenCalledTimes(1);
  });
});
