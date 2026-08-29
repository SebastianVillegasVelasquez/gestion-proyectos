import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListTodo, Package, Settings } from "lucide-react";

import { WorkspaceNav } from "./WorkspaceNav";

const items = [
  { id: "tareas" as const, label: "Tareas", Icon: ListTodo },
  { id: "entregables" as const, label: "Entregables", Icon: Package, count: 3 },
  { id: "configuracion" as const, label: "Configuración", Icon: Settings },
];

describe("WorkspaceNav", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* jsdom siempre lo tiene, pero por si acaso */
    }
  });

  it("marca la sección activa con aria-current y muestra el contador", () => {
    render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /tareas/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("no pinta contador cuando es 0 o indefinido", () => {
    render(
      <WorkspaceNav
        items={[{ id: "entregables" as const, label: "Entregables", Icon: Package, count: 0 }]}
        active="entregables"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("0")).toBeNull();
  });

  it("llama a onSelect con el id de la sección pulsada", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceNav items={items} active="tareas" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /configuración/i }));
    expect(onSelect).toHaveBeenCalledWith("configuracion");
  });

  it("colapsa a riel de iconos y recuerda la preferencia", async () => {
    const { unmount } = render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    // Expandido: se ven las etiquetas.
    expect(screen.getByText("Entregables")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /colapsar el menú/i }));
    expect(screen.queryByText("Entregables")).toBeNull();
    expect(localStorage.getItem("workspace.nav.collapsed")).toBe("1");

    // Al volver a montar arranca colapsado (preferencia recordada).
    unmount();
    render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    expect(screen.queryByText("Entregables")).toBeNull();
    expect(screen.getByRole("button", { name: /expandir el menú/i })).toBeInTheDocument();
  });
});
