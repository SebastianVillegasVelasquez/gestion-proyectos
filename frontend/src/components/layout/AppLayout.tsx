import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/layout/SideBar";
import { SpinnerScreen } from "@/components/common/Spinner";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { RemindersBell } from "@/features/reminders/components/RemindersBell";
import { ActiveProjectProvider } from "@/features/projects/context/ActiveProjectProvider";
import { WhatsNewProvider } from "@/features/whats-new/WhatsNewProvider";
import { ViewAsBanner } from "@/components/layout/ViewAsSwitcher";
import { FirstLoginPasswordGate } from "@/features/auth/components/FirstLoginPasswordGate";
import { useNotificationsSocket } from "@/features/notifications/hooks/use-notification-socket.ts";

export interface AppOutletContext {
  dark: boolean;
  toggleDark: () => void;
}

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Colapso del menú lateral en escritorio (se desliza para abrir/cerrar).
  const [collapsed, setCollapsed] = useState(false);
  // El tema ya lo aplicó el arranque (main.tsx) antes del primer pintado; aquí
  // solo se lee para que el interruptor muestre el estado correcto.
  const [dark, setDark] = useState(readStoredTheme);

  useEffect(() => {
    setCollapsed(localStorage.getItem("obj-sidebar-collapsed") === "true");
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
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
    <ActiveProjectProvider>
      <WhatsNewProvider>
        {/* Primer ingreso: si la cuenta entró con contraseña provisional, este
          modal cubre toda la app hasta que la persona cree la suya. */}
        <FirstLoginPasswordGate />
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          {/* Fondo del cajón — móvil y tablet (por debajo de lg) */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
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
            <ViewAsBanner />
            {/* Barra superior — móvil y tablet (por debajo de lg) */}
            <header className="flex shrink-0 items-center justify-between border-b border-brand-gold/30 bg-card px-4 py-3 lg:hidden">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(true);
                  }}
                  aria-label="Abrir menú de navegación"
                  className="flex size-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
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
                <RemindersBell placement="down" />
                <NotificationBell placement="down" />
                <button
                  type="button"
                  onClick={toggleDark}
                  aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
                  className="flex size-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                >
                  {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </button>
              </div>
            </header>

            {/* Page content — scrollable on mobile and tablet, fixed on desktop. */}
            <main className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden">
              <Suspense fallback={<SpinnerScreen />}>
                <Outlet context={context} />
              </Suspense>
            </main>
          </div>
        </div>
      </WhatsNewProvider>
    </ActiveProjectProvider>
  );
};
