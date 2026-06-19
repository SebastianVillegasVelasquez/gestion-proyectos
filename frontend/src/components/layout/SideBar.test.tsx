import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Sidebar } from "./SideBar";

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { name: "Ana López", role: "user" }, isAuthenticated: true }),
}));

// El pie del sidebar incluye <NotificationBell/>, que consulta el backend.
vi.mock("@/features/notifications/api/notifications.api", () => ({
  notificationsApi: {
    unreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
    list: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, unread_count: 0, page: 1, page_size: 10 }),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    dark: false,
    onToggleDark: vi.fn(),
    ...overrides,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Sidebar {...props} />
    </QueryClientProvider>,
  );
  return props;
}

describe("Sidebar collapse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onToggleCollapsed when the desktop collapse button is clicked", async () => {
    const props = renderSidebar();

    await userEvent.click(screen.getByLabelText("Cerrar menú lateral"));

    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("slides out of view on desktop when collapsed", () => {
    renderSidebar({ collapsed: true });

    // El <aside> aplica la clase de deslizamiento en escritorio.
    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("md:-translate-x-full");
  });

  it("stays in place on desktop when expanded", () => {
    renderSidebar({ collapsed: false });

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("md:translate-x-0");
  });
});
