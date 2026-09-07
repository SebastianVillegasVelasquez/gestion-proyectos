import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";

import { ManualPage } from "./ManualPage";
import { MANUAL_ARTICLES } from "../manual-content";

beforeAll(() => {
  // jsdom no implementa scrollIntoView y el manual lo usa al cambiar de tema.
  Element.prototype.scrollIntoView = () => undefined;
});

function renderManual(initialEntry = "/manual") {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return render(<ManualPage />, { wrapper: Wrapper });
}

/** El índice lateral, para no confundir sus enlaces con el texto del artículo. */
function index() {
  return screen.getByRole("navigation", { name: /Temas del manual/i });
}

describe("ManualPage", () => {
  it("abre el primer tema cuando la URL no pide ninguno", () => {
    renderManual();
    expect(screen.getByRole("heading", { name: "Qué es Bitácora OBJ" })).toBeInTheDocument();
  });

  it("abre el tema que pide la URL", () => {
    renderManual("/manual?tema=entregar-tarea");
    expect(screen.getByRole("heading", { name: "Entregar una tarea" })).toBeInTheDocument();
  });

  it("cae al primer tema si el de la URL no existe", () => {
    renderManual("/manual?tema=no-existe");
    expect(screen.getByRole("heading", { name: "Qué es Bitácora OBJ" })).toBeInTheDocument();
  });

  it("cambiar de tema desde el índice muestra su contenido", async () => {
    const user = userEvent.setup();
    renderManual();

    await user.click(within(index()).getByRole("button", { name: /Entregar una tarea/i }));

    expect(screen.getByRole("heading", { name: "Entregar una tarea" })).toBeInTheDocument();
    // El cuerpo del artículo se pinta, no solo el título.
    expect(screen.getByText(/no hay nada que adjuntar/i)).toBeInTheDocument();
  });

  it("el buscador acota el índice sin cambiar el tema abierto", async () => {
    const user = userEvent.setup();
    renderManual();

    await user.type(screen.getByRole("textbox", { name: /Buscar en el manual/i }), "archivos");

    const links = within(index()).getAllByRole("button");
    expect(links.length).toBeGreaterThan(0);
    // Acota de verdad: quedan menos temas que el índice completo.
    expect(links.length).toBeLessThan(MANUAL_ARTICLES.length);
    // El artículo abierto sigue siendo el mismo: buscar no navega.
    expect(screen.getByRole("heading", { name: "Qué es Bitácora OBJ" })).toBeInTheDocument();
  });

  it("avisa cuando la búsqueda no encuentra nada", async () => {
    const user = userEvent.setup();
    renderManual();

    await user.type(screen.getByRole("textbox", { name: /Buscar en el manual/i }), "xyzzy");

    expect(screen.getByText(/Nada coincide/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /Temas del manual/i })).toBeNull();
  });

  it("«Siguiente» avanza al tema que va detrás en el índice", async () => {
    const user = userEvent.setup();
    renderManual();

    await user.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByRole("heading", { name: "Tu primer ingreso" })).toBeInTheDocument();
    // Ya no es el primero: ahora sí hay "Anterior".
    expect(screen.getByRole("button", { name: /Anterior/i })).toBeInTheDocument();
  });

  it("marca los temas que solo aplican a quien lidera", () => {
    renderManual("/manual?tema=revisar-entregas");
    expect(screen.getAllByText("Líder").length).toBeGreaterThan(0);
  });
});
