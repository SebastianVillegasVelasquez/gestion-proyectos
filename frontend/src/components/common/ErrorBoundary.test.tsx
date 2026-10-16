import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("revienta al renderizar");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // El boundary registra el error por consola a propósito; no ensuciamos la
    // salida de los tests con algo que estamos provocando.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the fallback instead of letting the tree unmount", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  });

  it("keeps rendering its children while nothing fails", () => {
    render(
      <ErrorBoundary>
        <p>contenido normal</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("contenido normal")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("catches a lazy chunk that fails to load, which is the blank-page case", async () => {
    const Stale = lazy(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );

    render(
      <ErrorBoundary fallbackTitle="No se pudo cargar la aplicación">
        <Suspense fallback={<p>cargando</p>}>
          <Stale />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByText("No se pudo cargar la aplicación")).toBeInTheDocument();
  });

  it("offers a retry that re-renders the subtree", async () => {
    let shouldFail = true;
    function Flaky() {
      if (shouldFail) {
        throw new Error("falla la primera vez");
      }
      return <p>ya funciona</p>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldFail = false;
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(screen.getByText("ya funciona")).toBeInTheDocument();
  });

  it("reloads instead of re-rendering when asked to, for the root boundary", async () => {
    const reload = vi.fn();
    // Solo `reload`: window.location es una instancia y copiarla con spread
    // le quita el prototipo (y a eslint no le gusta, con razón).
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: window.location.href, reload },
    });

    render(
      <ErrorBoundary reloadOnRetry>
        <Boom />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: /recargar/i }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
