import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/layout/SideBar";
import { ProjectsProvider } from "@/features/projects/context/ProjectsContext";

export interface AppOutletContext {
  dark: boolean;
  toggleDark: () => void;
}

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("obj-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("obj-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
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
        dark={dark}
        onToggleDark={toggleDark}
      />

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
          <ProjectsProvider>
            <Outlet context={context} />
          </ProjectsProvider>
        </main>
      </div>
    </div>
  );
};
