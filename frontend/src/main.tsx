import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { clearStaleChunkLock, watchForStaleChunks } from "@/lib/stale-chunk-reload";
import { applyTheme, readStoredTheme } from "@/lib/theme";

// Defaults globales de cache: sin staleTime, cada montaje de un componente
// re-pide sus datos al backend aunque acaben de llegar. 30 s de frescura
// elimina las ráfagas de requests duplicadas al navegar entre vistas; las
// mutaciones invalidan su cache explícitamente, así que no se ven datos viejos.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Una pestaña abierta durante un despliegue pide chunks que ya no existen:
// recargamos una vez para traer la versión nueva.
watchForStaleChunks();
clearStaleChunkLock();

// Antes de montar: la clase `dark` debe estar puesta en el primer pintado.
applyTheme(readStoredTheme());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {/* Frontera de error de la raíz. Va DENTRO de los providers para que
              la pantalla de error conserve el tema y las rutas, y fuera de
              <App /> para cubrir también el arranque. Sin ella, cualquier
              excepción de render —o un chunk de una versión vieja— desmonta el
              árbol entero y deja una pantalla en blanco sin salida. */}
          <ErrorBoundary
            reloadOnRetry
            fallbackTitle="No se pudo cargar la aplicación"
            fallbackHint="Ocurrió un error inesperado al iniciar. Recarga la página; si vuelve a pasar, avísanos."
          >
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
