import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Sidebar } from "./SideBar";

// Rol controlable para distinguir la navegación de admin (SECTIONS) de la de
// usuario (USER_SECTIONS).
const authState = vi.hoisted(() => ({ role: "user" }));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { name: "Ana López", role: authState.role }, isAuthenticated: true }),
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

describe("Sidebar collapse (modo riel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = "user";
  });

  it("calls onToggleCollapsed when the desktop collapse button is clicked", async () => {
    const props = renderSidebar();

    await userEvent.click(screen.getByLabelText("Colapsar menú lateral"));

    expect(props.onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("becomes a narrow rail on desktop when collapsed (does not disappear)", () => {
    renderSidebar({ collapsed: true });

    const aside = screen.getByRole("complementary");
    // Riel angosto y SIEMPRE visible (no se desliza fuera de la pantalla).
    expect(aside.className).toContain("md:w-16");
    expect(aside.className).toContain("md:translate-x-0");
    expect(aside.className).not.toContain("md:-translate-x-full");
  });

  it("uses the full width on desktop when expanded", () => {
    renderSidebar({ collapsed: false });

    const aside = screen.getByRole("complementary");
    expect(aside.className).toContain("md:w-64");
  });

  it("keeps nav icons usable (interactive) when collapsed", () => {
    renderSidebar({ collapsed: true });

    // Aunque el texto se oculte en el riel, el botón sigue siendo accesible por
    // su nombre (aria-label) y operable (no deshabilitado).
    const overview = screen.getByRole("button", { name: "Vista general" });
    expect(overview).toBeEnabled();
  });
});

describe("Sidebar items (admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = "admin";
  });

  it("no longer shows Cronograma or Reportes", () => {
    renderSidebar();

    expect(screen.queryByRole("button", { name: "Cronograma" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reportes" })).not.toBeInTheDocument();
    // Configuración sí permanece y enlaza a la página de ajustes.
    expect(screen.getByRole("button", { name: "Configuración" })).toBeInTheDocument();
  });

  it("does not show the Feedback inbox for admins", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: "Feedback" })).not.toBeInTheDocument();
  });
});

describe("Sidebar feedback inbox (developer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = "developer";
  });

  it("shows the Feedback inbox and the full admin navigation", () => {
    renderSidebar();
    // Bandeja de feedback (exclusiva del developer)…
    expect(screen.getByRole("button", { name: "Feedback" })).toBeInTheDocument();
    // …además de la navegación completa que ve administración.
    expect(screen.getByRole("button", { name: "Todos los proyectos" })).toBeInTheDocument();
  });
});
