import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { FeedbackWidget } from "./FeedbackWidget";
import { feedbackApi } from "../api/feedback.api";

// Comportamiento nuevo: la validación del formulario (no se puede enviar un
// mensaje vacío/corto) y la categoría por defecto. No probamos el CRUD en sí.
vi.mock("../api/feedback.api", () => ({
  feedbackApi: { create: vi.fn() },
}));

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<FeedbackWidget />, { wrapper: Wrapper });
}

describe("FeedbackWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abre el formulario desde el botón flotante", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Abrir feedback" }));
    expect(screen.getByRole("dialog", { name: "Enviar feedback" })).toBeInTheDocument();
  });

  it("mantiene 'Enviar' deshabilitado hasta escribir un mensaje válido", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Abrir feedback" }));

    const submit = screen.getByRole("button", { name: "Enviar feedback" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Mensaje de feedback"), "ab"); // < 3
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Mensaje de feedback"), "c"); // 3 chars
    expect(submit).toBeEnabled();
  });

  it("envía la categoría seleccionada y el mensaje", async () => {
    vi.mocked(feedbackApi.create).mockResolvedValue({
      id: "f1",
      feedback_type: "negativo",
      message: "algo falla",
      page: "/",
      user_id: null,
      author_name: null,
      created_at: "2026-06-24T00:00:00Z",
    });
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Abrir feedback" }));
    await userEvent.click(screen.getByRole("button", { name: /Hay un problema/ }));
    await userEvent.type(screen.getByLabelText("Mensaje de feedback"), "algo falla");
    await userEvent.click(screen.getByRole("button", { name: "Enviar feedback" }));

    expect(feedbackApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ feedback_type: "negativo", message: "algo falla" }),
    );
    expect(await screen.findByText("¡Gracias por tu feedback!")).toBeInTheDocument();
  });
});
