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

  it("marca la sección activa con aria-current y muestra el contador (expandido)", async () => {
    render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /expandir el menú/i }));
    expect(screen.getByRole("button", { name: /tareas/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("no pinta contador cuando es 0 o indefinido", async () => {
    render(
      <WorkspaceNav
        items={[{ id: "entregables" as const, label: "Entregables", Icon: Package, count: 0 }]}
        active="entregables"
        onSelect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /expandir el menú/i }));
    expect(screen.queryByText("0")).toBeNull();
  });

  it("llama a onSelect con el id de la sección pulsada", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceNav items={items} active="tareas" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /configuración/i }));
    expect(onSelect).toHaveBeenCalledWith("configuracion");
  });

  it("arranca colapsado sin preferencia guardada, y recuerda la preferencia al expandir", async () => {
    const { unmount } = render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    // Sin preferencia guardada: arranca colapsado (riel de iconos), para no
    // restarle ancho a la tabla de tareas por defecto.
    expect(screen.queryByText("Entregables")).toBeNull();
    expect(screen.getByRole("button", { name: /expandir el menú/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /expandir el menú/i }));
    expect(screen.getByText("Entregables")).toBeInTheDocument();
    expect(localStorage.getItem("workspace.nav.collapsed")).toBe("0");

    // Al volver a montar respeta la preferencia guardada (expandido).
    unmount();
    render(<WorkspaceNav items={items} active="tareas" onSelect={vi.fn()} />);
    expect(screen.getByText("Entregables")).toBeInTheDocument();
  });
});
