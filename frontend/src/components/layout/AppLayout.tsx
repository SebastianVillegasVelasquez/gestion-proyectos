import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/layout/SideBar";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { FeedbackWidget } from "@/features/feedback/components/FeedbackWidget";
import { WhatsNewProvider } from "@/features/whats-new/WhatsNewProvider";
import { useNotificationsSocket } from "@/features/notifications/hooks/use-notification-socket.ts";

// Fallback mientras se descarga el chunk de la ruta (solo el área de contenido;
// el sidebar permanece visible).
function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-10">
      <span className="size-6 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
    </div>
  );
}

export interface AppOutletContext {
  dark: boolean;
  toggleDark: () => void;
}

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Colapso del menú lateral en escritorio (se desliza para abrir/cerrar).
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("obj-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    setCollapsed(localStorage.getItem("obj-sidebar-collapsed") === "true");
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("obj-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("obj-sidebar-collapsed", String(next));
      return next;
    });
  };

  useNotificationsSocket();
  const context: AppOutletContext = { dark, toggleDark };

  return (
    <WhatsNewProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => {
            setSidebarOpen(false);
          }}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          dark={dark}
          onToggleDark={toggleDark}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile-only topbar */}
          <header className="flex shrink-0 items-center justify-between border-b border-brand-gold/30 bg-card px-4 py-3 md:hidden">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(true);
                }}
                aria-label="Abrir menú de navegación"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                <Menu className="size-5" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src="/logo.webp"
                  alt="Bitácora OBJ"
                  className="h-7 w-7 shrink-0 rounded-lg object-contain"
                />
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Bitácora OBJ
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell placement="down" />
              <button
                type="button"
                onClick={toggleDark}
                aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </header>

          {/* Page content — scrollable on mobile, fixed on desktop. */}
          <main className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden">
            <Suspense fallback={<RouteFallback />}>
              <Outlet context={context} />
            </Suspense>
          </main>
        </div>

        {/* Botón de feedback siempre visible en la app autenticada. */}
        <FeedbackWidget />
      </div>
    </WhatsNewProvider>
  );
};
