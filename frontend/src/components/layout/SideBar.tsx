import { useNavigate, useLocation } from "react-router";
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  User,
  Users,
  Users2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  dot?: "blue" | "amber" | "emerald";
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    id: "main",
    title: "Principal",
    items: [{ id: "overview", label: "Vista general", icon: LayoutDashboard, href: "/" }],
  },
  {
    id: "projects",
    title: "Proyectos",
    items: [
      { id: "project-builder", label: "Constructor", icon: Layers, href: "/projects/builder" },
      { id: "all-projects", label: "Todos los proyectos", icon: FolderKanban, href: "/projects" },
      { id: "ecommerce", label: "Rediseño e-commerce", icon: FolderKanban, dot: "emerald" },
      { id: "mobile", label: "App móvil inventario", icon: FolderKanban, dot: "amber" },
      { id: "bi", label: "Automatización BI", icon: FolderKanban, dot: "blue" },
    ],
  },
  {
    id: "collaborators",
    title: "Colaboradores",
    items: [
      { id: "workspace", label: "Espacios de Trabajo", icon: Users2, href: "/workspace" },
      { id: "collab-individual", label: "Individual", icon: User },
      { id: "collab-area", label: "Por área", icon: Users },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [
      { id: "schedule", label: "Cronograma", icon: CalendarDays },
      { id: "reports", label: "Reportes", icon: BarChart3 },
      { id: "settings", label: "Configuración", icon: Settings },
    ],
  },
];

const ROUTE_TO_ITEM: Record<string, string> = {
  "/": "overview",
  "/projects": "all-projects",
  "/projects/builder": "project-builder",
  "/workspace": "workspace",
};

const DOT_COLORS: Record<NonNullable<NavItem["dot"]>, string> = {
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Sidebar({ isOpen, onClose, dark, onToggleDark }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const active = ROUTE_TO_ITEM[location.pathname] ?? "overview";

  const handleNavClick = (item: NavItem) => {
    if (item.href) {navigate(item.href);}
    onClose();
  };

  return (
    <aside
      className={cn(
        // Base layout
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col",
        // Colors: light / dark
        "border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        // Transition for mobile slide-in
        "transition-transform duration-300 ease-in-out",
        // Desktop: always visible as sticky column; mobile: controlled by isOpen
        "md:sticky md:top-0 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo + mobile close button */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            OD
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              OBJ DIGITAL
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Project Manager
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 md:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {SECTIONS.map((section) => (
          <div key={section.id} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {section.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { handleNavClick(item); }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                        isActive
                          ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-600/15 dark:text-blue-300"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      {item.dot ? (
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[item.dot])} />
                      ) : (
                        <Icon className="size-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {item.badge != null && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: user + dark toggle */}
      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-sm font-semibold text-blue-600 dark:bg-blue-600/20 dark:text-blue-300">
            RS
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              Rodrigo Salinas
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">Administrador</p>
          </div>
          {/* Dark toggle — visible only on desktop (mobile has one in the topbar) */}
          <button
            type="button"
            onClick={onToggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="hidden h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:flex"
          >
            {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
