import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type * as progressApi from "../api/task-progress.api";
import type { TaskProgress } from "../api/task-progress.api";
import { TaskProgressDialog } from "./TaskProgressDialog";

const get = vi.fn();
const register = vi.fn();
vi.mock("../api/task-progress.api", async (importOriginal) => ({
  ...(await importOriginal<typeof progressApi>()),
  taskProgressApi: {
    get: (id: string) => get(id) as Promise<TaskProgress>,
    register: (id: string, body: unknown) => register(id, body) as Promise<TaskProgress>,
  },
}));

const editable: TaskProgress = {
  task_id: "t1",
  project_id: "p1",
  progress_pct: 35,
  manual_progress_pct: null,
  can_edit: true,
  locked_reason: null,
  has_deliverable: false,
  updates: [],
  evidence_options: [],
};

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TaskProgressDialog taskId="t1" taskTitle="Guion" onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("TaskProgressDialog", () => {
  beforeEach(() => {
    get.mockReset();
    register.mockReset();
  });

  it("keeps Guardar disabled until there is a new value AND an evidence", async () => {
    get.mockResolvedValue(editable);
    register.mockResolvedValue(editable);
    renderDialog();

    const save = await screen.findByRole("button", { name: "Guardar avance" });
    expect(save).toBeDisabled();

    const slider = screen.getByLabelText("Nuevo avance");
    // Valor nuevo, todavía sin evidencia.
    fireEvent.change(slider, { target: { value: "60" } });
    expect(save).toBeDisabled();

    await userEvent.upload(
      screen.getByLabelText("Archivo de evidencia"),
      new File(["x"], "avance.pdf", { type: "application/pdf" }),
    );
    await waitFor(() => {
      expect(save).toBeEnabled();
    });

    await userEvent.click(save);
    await waitFor(() => {
      expect(register).toHaveBeenCalledOnce();
    });
    const [, body] = register.mock.calls[0] as [string, { evidence: { kind: string } }];
    expect(body.evidence.kind).toBe("upload");
  });

  it("explains why it cannot be edited and hides the form", async () => {
    get.mockResolvedValue({
      ...editable,
      can_edit: false,
      locked_reason: "El avance de esta tarea se calcula con sus subtareas.",
    });
    renderDialog();

    expect(await screen.findByText(/se calcula con sus subtareas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar avance" })).not.toBeInTheDocument();
  });
});
