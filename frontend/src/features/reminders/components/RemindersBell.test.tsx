import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { RemindersBell } from "./RemindersBell";
import { remindersApi } from "../api/reminders.api";
import type { Reminder } from "../types";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../api/reminders.api", () => ({
  remindersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(),
  },
}));

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<RemindersBell />, { wrapper: Wrapper });
}

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: "r1",
    title: "Llamar al cliente",
    note: null,
    remind_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    channel: "notificacion",
    status: "pendiente",
    sent_at: null,
    created_at: "2026-08-28T10:00:00Z",
    ...over,
  };
}

describe("RemindersBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(remindersApi.list).mockResolvedValue([reminder()]);
    vi.mocked(remindersApi.create).mockResolvedValue(reminder({ id: "r2" }));
    vi.mocked(remindersApi.remove).mockResolvedValue(undefined);
  });

  it("shows the pending count on the badge and lists reminders when opened", async () => {
    renderBell();
    await userEvent.click(screen.getByLabelText("Recordatorios"));
    expect(await screen.findByText("Llamar al cliente")).toBeInTheDocument();
  });

  it("creates a reminder from the quick form", async () => {
    renderBell();
    await userEvent.click(screen.getByLabelText("Recordatorios"));
    await userEvent.type(screen.getByPlaceholderText("Recordarme…"), "Revisar guion");
    await userEvent.click(screen.getByRole("button", { name: /Añadir recordatorio/i }));

    await waitFor(() => {
      expect(remindersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Revisar guion", channel: "notificacion" }),
      );
    });
  });

  it("deletes a reminder", async () => {
    renderBell();
    await userEvent.click(screen.getByLabelText("Recordatorios"));
    await screen.findByText("Llamar al cliente");
    await userEvent.click(screen.getByLabelText("Eliminar recordatorio"));

    await waitFor(() => {
      expect(remindersApi.remove).toHaveBeenCalledWith("r1");
    });
  });
});
