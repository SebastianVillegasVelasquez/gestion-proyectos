import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useDashboardSummary, dashboardKeys } from "./use-dashboard-summary";
import { dashboardApi } from "../api/dashboard.api";

vi.mock("../api/dashboard.api", () => ({
  dashboardApi: { getSummary: vi.fn() },
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const summary = {
  active_projects: 3,
  total_tasks: 10,
  completed_tasks: 4,
  in_review_tasks: 2,
  overdue_tasks: 1,
};

describe("useDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a stable, namespaced query key", () => {
    expect(dashboardKeys.summary()).toEqual(["dashboard", "summary"]);
  });

  it("returns data from the api on success", async () => {
    vi.mocked(dashboardApi.getSummary).mockResolvedValue(summary);

    const { result } = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(summary);
    expect(dashboardApi.getSummary).toHaveBeenCalledTimes(1);
  });

  it("exposes isError when the api rejects", async () => {
    vi.mocked(dashboardApi.getSummary).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDashboardSummary(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
