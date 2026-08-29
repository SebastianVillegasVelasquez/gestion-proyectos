import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type * as ReactRouter from "react-router";
import type { ReactNode } from "react";

import { NotificationBell } from "./NotificationBell";
import { notificationsApi } from "../api/notifications.api";
import type { AppNotification, PaginatedNotifications } from "../types";

const navigateSpy = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { role: "user" } }),
}));

vi.mock("../api/notifications.api", () => ({
  notificationsApi: {
    unreadCount: vi.fn(),
    list: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<NotificationBell />, { wrapper: Wrapper });
}

function notif(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    message: "Se te asignó la tarea Guion Unidad 1",
    user_to_id: "u1",
    actor_id: null,
    notification_type: "tarea_asignada",
    payload: null,
    read_at: null,
    is_read: false,
    created_at: "2026-06-18T11:00:00Z",
    ...over,
  };
}

function listPage(items: AppNotification[]): PaginatedNotifications {
  return { items, total: items.length, unread_count: items.length, page: 1, page_size: 10 };
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateSpy.mockReset();
    vi.mocked(notificationsApi.list).mockResolvedValue(listPage([notif()]));
    vi.mocked(notificationsApi.markAllAsRead).mockResolvedValue({ updated: 1 });
    vi.mocked(notificationsApi.markAsRead).mockResolvedValue(notif({ is_read: true }));
  });

  it("shows the unread badge from the count endpoint", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 3 });
    renderBell();

    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 9+", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 42 });
    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("opens the panel and lists notifications", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 1 });
    renderBell();

    await userEvent.click(screen.getByLabelText("Notificaciones"));

    expect(await screen.findByText("Se te asignó la tarea Guion Unidad 1")).toBeInTheDocument();
  });

  it("marks all as read", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 1 });
    renderBell();
    await userEvent.click(screen.getByLabelText("Notificaciones"));
    await screen.findByText("Se te asignó la tarea Guion Unidad 1");

    await userEvent.click(screen.getByText("Marcar todas"));

    await waitFor(() => {
      expect(notificationsApi.markAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates to the workspace with the task focused when a user clicks a task notification", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 1 });
    vi.mocked(notificationsApi.list).mockResolvedValue(
      listPage([notif({ payload: { task_id: "t-123", project_id: "p-9" } })]),
    );
    renderBell();
    await userEvent.click(screen.getByLabelText("Notificaciones"));

    await userEvent.click(await screen.findByText("Se te asignó la tarea Guion Unidad 1"));

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith("/workspace?focus=t-123");
    });
    expect(notificationsApi.markAsRead).toHaveBeenCalledWith("n1");
  });

  it("degrades gracefully when the list endpoint fails", async () => {
    vi.mocked(notificationsApi.unreadCount).mockResolvedValue({ unread_count: 0 });
    vi.mocked(notificationsApi.list).mockRejectedValue(new Error("503"));
    renderBell();

    await userEvent.click(screen.getByLabelText("Notificaciones"));

    expect(
      await screen.findByText("Las notificaciones no están disponibles por ahora."),
    ).toBeInTheDocument();
  });
});
