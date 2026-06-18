import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Moon, PanelLeftOpen, Sun } from "lucide-react";
import { Sidebar } from "@/components/layout/SideBar";

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

  const context: AppOutletContext = { dark, toggleDark };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
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

      {/* Botón flotante para reabrir el menú en escritorio cuando está colapsado */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Abrir menú lateral"
          className="fixed left-3 top-3 z-50 hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:flex"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile-only topbar */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
              }}
              aria-label="Abrir menú de navegación"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                OD
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                OBJ DIGITAL
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>

        {/* Page content — scrollable on mobile, fixed on desktop */}
        <main className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};
