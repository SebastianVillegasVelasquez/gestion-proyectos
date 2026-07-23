import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useNotificationsSocket } from "./use-notification-socket";

// ── Mocks de auth: controlamos si hay sesión y qué token se lee ──
interface MockAuthState {
  user: { id: string } | null;
  isAuthenticated: boolean;
}

const authState = vi.hoisted(() => {
  const state: { value: MockAuthState } = {
    value: { user: { id: "u1" }, isAuthenticated: true },
  };
  return state;
});

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => authState.value,
}));

vi.mock("@/features/auth/utils/session.utils", () => ({
  readSession: () => ({ accessToken: "token-123" }),
}));

// ── Mock de la API WebSocket del navegador ──
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useNotificationsSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    authState.value = { user: { id: "u1" }, isAuthenticated: true };
    vi.clearAllMocks();
  });

  it("abre una conexión WebSocket cuando el usuario está autenticado", () => {
    const client = makeClient();
    renderHook(
      () => {
        useNotificationsSocket();
      },
      { wrapper: makeWrapper(client) },
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("token=token-123");
  });

  it("invalida el cache de notificaciones al recibir 'notification.new'", () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(
      () => {
        useNotificationsSocket();
      },
      { wrapper: makeWrapper(client) },
    );

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "notification.new" }) });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("ignora mensajes de un tipo desconocido", () => {
    const client = makeClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    renderHook(
      () => {
        useNotificationsSocket();
      },
      { wrapper: makeWrapper(client) },
    );

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "otra.cosa" }) });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("no abre conexión si el usuario no está autenticado", () => {
    authState.value = { user: null, isAuthenticated: false };
    const client = makeClient();
    renderHook(
      () => {
        useNotificationsSocket();
      },
      { wrapper: makeWrapper(client) },
    );

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("cierra la conexión al desmontar", () => {
    const client = makeClient();
    const { unmount } = renderHook(
      () => {
        useNotificationsSocket();
      },
      {
        wrapper: makeWrapper(client),
      },
    );

    const ws = MockWebSocket.instances[0];
    unmount();

    expect(ws.close).toHaveBeenCalled();
  });
});
