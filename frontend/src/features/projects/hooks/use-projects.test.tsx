import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useProjects, useCreateProject } from "./use-projects";
import { projectsApi } from "../api/projects.api";

vi.mock("../api/projects.api", () => ({
  projectsApi: { list: vi.fn(), create: vi.fn() },
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const projects = [
  {
    id: "p1",
    name: "Demo",
    description: null,
    client_name: null,
    start_date: null,
    end_date: null,
    progress_pct: 0,
  },
];

describe("useProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the project list on success", async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(projects);

    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(projects);
  });
});

describe("useCreateProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the api with the payload", async () => {
    vi.mocked(projectsApi.create).mockResolvedValue(projects[0]);

    const { result } = renderHook(() => useCreateProject(), { wrapper: makeWrapper() });
    result.current.mutate({ name: "Nuevo" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(projectsApi.create).toHaveBeenCalledWith({ name: "Nuevo" });
  });
});
