import { useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Moon,
  PanelLeftClose,
  Settings,
  Sun,
  User,
  Users2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { initialsFromName } from "@/features/dashboard/utils/greeting";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "Super administrador",
  [Role.ADMIN]: "Administrador",
  [Role.USER]: "Usuario",
};

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
    ],
  },
  {
    id: "collaborators",
    title: "Colaboradores",
    items: [
      { id: "workspace", label: "Espacios de Trabajo", icon: Users2, href: "/workspace" },
      { id: "collab-individual", label: "Individual", icon: User, href: "/collaborators" },
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
  "/collaborators": "collab-individual",
};

const DOT_COLORS: Record<NonNullable<NavItem["dot"]>, string> = {
  blue: "bg-brand-teal",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  collapsed,
  onToggleCollapsed,
  dark,
  onToggleDark,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const active = ROUTE_TO_ITEM[location.pathname] ?? "overview";

  const handleNavClick = (item: NavItem) => {
    if (item.href) {
      void navigate(item.href);
    }
    onClose();
  };

  return (
    <aside
      className={cn(
        // Base layout
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col",
        // Superficie de marca: sidebar oscuro en ambos modos
        "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        // Animación del deslizamiento (posición y margen para liberar espacio)
        "transition-[transform,margin] duration-300 ease-in-out",
        "md:sticky md:top-0",
        // Móvil: panel deslizante controlado por isOpen
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Escritorio: al colapsar se desliza fuera y libera su columna
        // (margen negativo); si no, visible en su sitio.
        collapsed ? "md:-ml-64 md:-translate-x-full" : "md:ml-0 md:translate-x-0",
      )}
    >
      {/* Logo + mobile close button */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-sidebar-foreground">Bitácora OBJ</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
              Gestión de proyectos
            </p>
          </div>
        </div>
        {/* Móvil: cerrar el panel deslizante */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/10 hover:text-sidebar-foreground md:hidden"
        >
          <X className="size-4" />
        </button>
        {/* Escritorio: colapsar/deslizar el menú para ganar espacio */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Cerrar menú lateral"
          className="hidden h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/10 hover:text-sidebar-foreground md:flex"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {SECTIONS.map((section) => (
          <div key={section.id} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
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
                      onClick={() => {
                        handleNavClick(item);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                        isActive
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                      )}
                    >
                      {item.dot ? (
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[item.dot])}
                        />
                      ) : (
                        <Icon className="size-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {item.badge != null && (
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-sidebar-foreground">
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
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-sm font-semibold text-brand-gold">
            {user ? initialsFromName(user.name) : "?"}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name ?? "Invitado"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/45">
              {user ? ROLE_LABELS[user.role] : ""}
            </p>
          </div>
          {/* Notificaciones + tema — solo escritorio (en móvil están en la barra superior) */}
          <div className="hidden items-center gap-0.5 md:flex">
            <NotificationBell placement="up" />
            <button
              type="button"
              onClick={onToggleDark}
              aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/10 hover:text-sidebar-foreground"
            >
              {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
