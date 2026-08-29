import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceNavItem<T extends string> {
  id: T;
  label: string;
  Icon: React.ElementType;
  /** Contador opcional a la derecha del ítem (ej. nº de entregables). */
  count?: number;
  /** Texto de apoyo bajo la etiqueta. */
  hint?: string;
}

interface WorkspaceNavProps<T extends string> {
  items: WorkspaceNavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
}

const STORAGE_KEY = "workspace.nav.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Menú lateral derecho del espacio de trabajo (estilo Linear/Notion): la
 * navegación entre secciones vive aquí, no en pestañas arriba, para que el
 * contenido use todo el ancho. Se puede colapsar a un riel de iconos; la
 * preferencia se recuerda por navegador.
 */
export function WorkspaceNav<T extends string>({ items, active, onSelect }: WorkspaceNavProps<T>) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* almacenamiento no disponible: la preferencia dura solo esta sesión */
    }
  }, [collapsed]);

  return (
    <nav
      aria-label="Secciones del equipo"
      className={cn(
        "flex shrink-0 flex-col gap-0.5 border-l border-slate-200 bg-white p-2 transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-900",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <button
        type="button"
        onClick={() => {
          setCollapsed((v) => !v);
        }}
        aria-label={collapsed ? "Expandir el menú" : "Colapsar el menú"}
        aria-expanded={!collapsed}
        className={cn(
          "mb-1 flex items-center rounded-lg px-2 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300",
          collapsed ? "justify-center" : "justify-end",
        )}
      >
        {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
      </button>

      {items.map(({ id, label, Icon, count, hint }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? label : undefined}
            onClick={() => {
              onSelect(id);
            }}
            className={cn(
              "flex items-center rounded-lg py-2 text-left text-[13px] font-medium transition-colors",
              collapsed ? "justify-center px-0" : "gap-2.5 px-3",
              isActive
                ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
            )}
          >
            <span className="relative">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  isActive ? "text-brand-gold-dark dark:text-brand-gold" : "",
                )}
              />
              {/* Colapsado: el contador se reduce a un punto para no perder la señal. */}
              {collapsed && count !== undefined && count > 0 && (
                <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-brand-gold" />
              )}
            </span>

            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  {hint && (
                    <span className="block truncate text-[11px] font-normal text-slate-400 dark:text-slate-500">
                      {hint}
                    </span>
                  )}
                </span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      isActive
                        ? "bg-white/70 text-brand-gold-dark dark:bg-slate-900/50 dark:text-brand-gold"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    )}
                  >
                    {count}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
