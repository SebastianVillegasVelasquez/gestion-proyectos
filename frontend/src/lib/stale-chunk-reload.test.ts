import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearStaleChunkLock, watchForStaleChunks } from "./stale-chunk-reload";

const reload = vi.fn();

function failPreload(): void {
  window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
}

describe("watchForStaleChunks", () => {
  beforeEach(() => {
    reload.mockReset();
    sessionStorage.clear();
    // Solo `reload`: window.location es una instancia y copiarla con spread
    // le quita el prototipo (y a eslint no le gusta, con razón).
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: window.location.href, reload },
    });
    watchForStaleChunks();
  });

  it("reloads when a chunk of an older deploy is gone", () => {
    failPreload();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads only once, so a broken asset cannot loop forever", () => {
    failPreload();
    failPreload();
    failPreload();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("arms again once the app has started cleanly", () => {
    failPreload();
    expect(reload).toHaveBeenCalledTimes(1);

    // Siguiente arranque correcto: se suelta el candado.
    clearStaleChunkLock();
    failPreload();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does nothing on an ordinary error event", () => {
    window.dispatchEvent(new Event("error"));

    expect(reload).not.toHaveBeenCalled();
  });
});
