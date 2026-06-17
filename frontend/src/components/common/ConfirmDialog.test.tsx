import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const base = {
    title: "Eliminar equipo",
    message: "¿Seguro?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("calls onConfirm when the confirm button is pressed", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} confirmLabel="Eliminar" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel from the cancel button", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables the buttons and shows a spinner label while loading", () => {
    render(<ConfirmDialog {...base} loading confirmLabel="Eliminar" />);

    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("surfaces a clear error message when provided", () => {
    render(<ConfirmDialog {...base} errorMessage="No se pudo eliminar el equipo" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo eliminar el equipo");
  });
});
