import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TaskEffortPanel } from "./TaskEffortPanel";
import { tasksApi } from "../api/tasks.api";
import type { TaskEffort } from "../types/api.types";

vi.mock("../api/tasks.api", () => ({
  tasksApi: {
    effort: vi.fn(),
    logTime: vi.fn(),
    deleteTimeEntry: vi.fn(),
  },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TaskEffortPanel projectId="p1" taskId="t1" />, { wrapper: Wrapper });
}

function effort(over: Partial<TaskEffort> = {}): TaskEffort {
  return {
    task_id: "t1",
    estimated_days: "8",
    logged_days: "3",
    entries: [
      {
        id: "e1",
        task_id: "t1",
        user_id: "u1",
        user_name: "Ana García",
        days: "0.5",
        work_date: "2026-08-25",
        notes: "Guion y storyboard",
        created_at: null,
      },
    ],
    ...over,
  };
}

describe("TaskEffortPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApi.effort).mockResolvedValue(effort());
    vi.mocked(tasksApi.logTime).mockResolvedValue({} as never);
    vi.mocked(tasksApi.deleteTimeEntry).mockResolvedValue(undefined);
  });

  it("muestra lo dedicado frente a lo estimado", async () => {
    renderPanel();

    expect(await screen.findByText(/de 8 d/)).toBeTruthy();
    expect(screen.getByText(/3 d/)).toBeTruthy();
    expect(screen.getByText(/0,5 d/)).toBeTruthy();
  });

  it("lista los apuntes con quién y cuándo", async () => {
    renderPanel();

    expect(await screen.findByText(/Ana García/)).toBeTruthy();
    expect(screen.getByText("2026-08-25")).toBeTruthy();
  });

  it("registra la dedicación de un día", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText(/Ana García/);

    await user.click(screen.getByRole("button", { name: /Registrar dedicación/i }));
    await user.type(screen.getByLabelText(/Días dedicados/i), "0.5");
    await user.click(screen.getByRole("button", { name: /^Registrar$/i }));

    await waitFor(() => {
      expect(tasksApi.logTime).toHaveBeenCalledWith("t1", expect.objectContaining({ days: "0.5" }));
    });
  });

  it("no deja registrar sin dedicación", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText(/Ana García/);

    await user.click(screen.getByRole("button", { name: /Registrar dedicación/i }));

    expect(screen.getByRole("button", { name: /^Registrar$/i })).toHaveProperty("disabled", true);
  });

  it("avisa cuando se pasa de lo estimado, sin bloquear nada", async () => {
    vi.mocked(tasksApi.effort).mockResolvedValue(
      effort({ logged_days: "12", estimated_days: "8" }),
    );
    renderPanel();

    expect(await screen.findByText(/más de lo estimado/i)).toBeTruthy();
    // Y se puede seguir registrando: pasarse es un dato, no un error.
    expect(screen.getByRole("button", { name: /Registrar dedicación/i })).toBeTruthy();
  });

  it("borra un apunte", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText(/Ana García/);

    await user.click(screen.getByLabelText(/Borrar registro/i));

    await waitFor(() => {
      expect(tasksApi.deleteTimeEntry).toHaveBeenCalledWith("e1");
    });
  });

  it("indica cuando nadie ha registrado dedicación todavía", async () => {
    vi.mocked(tasksApi.effort).mockResolvedValue(
      effort({ entries: [], logged_days: "0", estimated_days: null }),
    );
    renderPanel();

    expect(await screen.findByText(/Nadie ha registrado dedicación/i)).toBeTruthy();
  });
});
