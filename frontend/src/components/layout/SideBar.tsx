import { useLocation, useNavigate } from "react-router";
import {
  FolderKanban,
  FolderPlus,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MailCheck,
  type LucideIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  UserCog,
  Users2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useLogout } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { initialsFromName } from "@/features/dashboard/utils/greeting";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { RemindersBell } from "@/features/reminders/components/RemindersBell";

const ROLE_LABELS: Record<Role, string> = {
  [Role.DEVELOPER]: "Developer",
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
      {
        id: "project-builder",
        label: "Nuevo proyecto",
        icon: FolderPlus,
        href: "/projects/builder",
      },
      { id: "all-projects", label: "Todos los proyectos", icon: FolderKanban, href: "/projects" },
    ],
  },
  {
    id: "collaborators",
    title: "Colaboradores",
    items: [
      { id: "workspace", label: "Espacios de Trabajo", icon: Users2, href: "/workspace" },
      { id: "my-deliverables", label: "Mis tareas", icon: ListTodo, href: "/mis-entregas" },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [
      { id: "users", label: "Usuarios", icon: UserCog, href: "/admin/users" },
      { id: "settings", label: "Configuración", icon: Settings, href: "/settings" },
    ],
  },
];

// El rol User solo ve su dashboard, sus proyectos y los espacios de trabajo
// (sin gestión global).
const USER_SECTIONS: NavSection[] = [
  {
    id: "main",
    title: "Principal",
    items: [{ id: "overview", label: "Vista general", icon: LayoutDashboard, href: "/" }],
  },
  {
    id: "workspace",
    title: "Trabajo",
    items: [
      { id: "my-projects", label: "Mis proyectos", icon: FolderKanban, href: "/mis-proyectos" },
      { id: "workspace", label: "Espacios de Trabajo", icon: Users2, href: "/workspace" },
      { id: "my-deliverables", label: "Mis tareas", icon: ListTodo, href: "/mis-entregas" },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [{ id: "settings", label: "Configuración", icon: Settings, href: "/settings" }],
  },
];

// El developer ve la navegación completa MÁS la bandeja de feedback.
const DEVELOPER_SECTIONS: NavSection[] = SECTIONS.map((section) =>
  section.id === "general"
    ? {
        ...section,
        items: [
          { id: "feedback", label: "Feedback", icon: Inbox, href: "/feedback" },
          { id: "email-test", label: "Correos", icon: MailCheck, href: "/dev/email-test" },
          ...section.items,
        ],
      }
    : section,
);

const ROUTE_TO_ITEM: Record<string, string> = {
  "/": "overview",
  "/projects": "all-projects",
  "/projects/builder": "project-builder",
  "/mis-proyectos": "my-projects",
  "/workspace": "workspace",
  "/mis-entregas": "my-deliverables",
  "/settings": "settings",
  "/feedback": "feedback",
  "/dev/email-test": "email-test",
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
  const logout = useLogout();

  // User: navegación reducida. Developer: completa + bandeja de feedback.
  // Resto (admin/super_admin): navegación completa.
  const sections =
    user?.role === Role.USER
      ? USER_SECTIONS
      : user?.role === Role.DEVELOPER
        ? DEVELOPER_SECTIONS
        : SECTIONS;

  const active = ROUTE_TO_ITEM[location.pathname] ?? "overview";

  const handleNavClick = (item: NavItem) => {
    if (item.href) {
      void navigate(item.href);
    }
    onClose();
  };

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        // Base layout (ancho de cajón en móvil)
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col",
        // Superficie de marca: sidebar oscuro en ambos modos
        "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        // Animación: en móvil desliza (transform); en escritorio cambia el ancho.
        "transition-[transform,width] duration-300 ease-in-out",
        // Móvil: panel deslizante controlado por isOpen
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Escritorio: siempre visible y en flujo; colapsado = riel angosto
        // que solo muestra iconos (sin desaparecer).
        "md:sticky md:top-0 md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-64",
      )}
    >
      {/* Logo + controles de colapso */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-5",
          collapsed ? "md:flex-col md:gap-2 md:px-2" : "justify-between px-5",
        )}
      >
        <div className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <div className={cn("leading-tight", collapsed && "md:hidden")}>
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
        {/* Escritorio: colapsar/expandir el riel */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
          className="hidden h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors duration-150 hover:bg-white/10 hover:text-sidebar-foreground md:flex"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-1", collapsed ? "md:px-2" : "px-3")}>
        {sections.map((section) => (
          <div key={section.id} className="mb-5">
            <p
              className={cn(
                "px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45",
                collapsed && "md:hidden",
              )}
            >
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
                      // En modo riel el label se oculta visualmente; el title da
                      // un tooltip y el aria-label mantiene el botón accesible.
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg py-2 text-sm transition-colors duration-150",
                        collapsed ? "md:justify-center md:px-0 px-3" : "px-3",
                        isActive
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                      )}
                    >
                      {item.dot && !collapsed ? (
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[item.dot])}
                        />
                      ) : (
                        <Icon className="size-4 shrink-0" />
                      )}
                      <span className={cn("flex-1 truncate text-left", collapsed && "md:hidden")}>
                        {item.label}
                      </span>
                      {item.badge != null && (
                        <span
                          className={cn(
                            "rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-sidebar-foreground",
                            collapsed && "md:hidden",
                          )}
                        >
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
      <div className={cn("border-t border-sidebar-border py-4", collapsed ? "md:px-2" : "px-4")}>
        <div className={cn("flex items-center gap-3", collapsed && "md:flex-col md:gap-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-sm font-semibold text-brand-gold">
            {user ? initialsFromName(user.name) : "?"}
          </div>
          <div className={cn("min-w-0 flex-1 leading-tight", collapsed && "md:hidden")}>
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.name ?? "Invitado"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/45">
              {user ? ROLE_LABELS[user.role] : ""}
            </p>
          </div>
          {/* Notificaciones + tema — solo escritorio (en móvil están en la barra superior) */}
          <div className={cn("hidden items-center gap-0.5 md:flex", collapsed && "md:flex-col")}>
            <RemindersBell placement="up" />
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

        {/* Cerrar sesión: limpia los tokens y vuelve al login */}
        <button
          type="button"
          onClick={() => {
            logout.mutate();
          }}
          disabled={logout.isPending}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "mt-3 flex w-full items-center gap-2.5 rounded-lg py-2 text-sm text-sidebar-foreground/60 transition-colors duration-150 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-60",
            collapsed ? "md:justify-center md:px-0 px-3" : "px-3",
          )}
        >
          <LogOut className="size-4 shrink-0" />
          <span className={cn("truncate", collapsed && "md:hidden")}>
            {logout.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
          </span>
        </button>
      </div>
    </aside>
  );
}
