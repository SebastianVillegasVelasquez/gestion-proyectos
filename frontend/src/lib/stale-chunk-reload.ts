// Recarga automática cuando la pestaña quedó en una versión vieja de la app.
//
// Las rutas se cargan por demanda (`lazy()`), y los assets de Vite llevan hash
// en el nombre con cache inmutable de un año. Si se despliega mientras alguien
// tiene la pestaña abierta, los chunks que esa pestaña todavía no descargó ya no
// existen en el servidor: el `import()` falla con un 404 y, sin una frontera de
// error, React desmonta el árbol y queda una pantalla en blanco. `index.html` sí
// va con `no-cache`, así que recargar siempre trae la versión nueva.
//
// Vite emite `vite:preloadError` en `window` cuando falla la precarga de un
// chunk. No llamamos a `preventDefault()`: dejamos que el error siga su curso
// (lo recoge la frontera de error) y además recargamos.

const RELOADED_KEY = "obj-stale-chunk-reloaded";

/**
 * Deja la app recargándose una sola vez ante un chunk que ya no existe.
 *
 * El candado va en `sessionStorage`: si tras recargar el import vuelve a fallar,
 * el problema no es una versión vieja (red caída, asset roto en el despliegue) y
 * recargar en bucle solo dejaría a la persona ante un parpadeo infinito. En ese
 * caso se muestra la pantalla de error, que sí tiene salida.
 */
export function watchForStaleChunks(): void {
  window.addEventListener("vite:preloadError", () => {
    try {
      if (sessionStorage.getItem(RELOADED_KEY)) {
        return;
      }
      sessionStorage.setItem(RELOADED_KEY, "1");
    } catch {
      // Sin sessionStorage no hay candado posible: preferimos no recargar a
      // arriesgar un bucle.
      return;
    }
    window.location.reload();
  });
}

/** Al arrancar bien se suelta el candado, listo para el siguiente despliegue. */
export function clearStaleChunkLock(): void {
  try {
    sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // Irrelevante: sin storage no hay candado que soltar.
  }
}
