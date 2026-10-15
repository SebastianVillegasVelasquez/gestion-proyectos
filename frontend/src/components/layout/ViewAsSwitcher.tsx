import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";

export const ROLE_LABELS: Record<Role, string> = {
  [Role.DEVELOPER]: "Developer",
  [Role.SUPER_ADMIN]: "Super administrador",
  [Role.ADMIN]: "Administrador",
  [Role.USER]: "Usuario",
};

/**
 * «Ver como…»: previsualiza la app con la navegación y las pantallas de un rol
 * inferior al tuyo. Solo se ofrece a quien tiene algún rol por debajo; mientras
 * dura la vista previa todo es de solo lectura (ver `view-as.ts`).
 */
export function ViewAsSwitcher({ collapsed }: { collapsed: boolean }) {
  const { realRole, viewAsRole, previewableRoles, setViewAsRole } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (!realRole || previewableRoles.length === 0) {
    return null;
  }

  const pick = (role: Role | null) => {
    setViewAsRole(role);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative mt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? "Ver como otro rol" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg py-2 text-sm transition-colors duration-150",
          collapsed ? "md:justify-center md:px-0 px-3" : "px-3",
          viewAsRole
            ? "bg-brand-gold/15 text-brand-gold"
            : "text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground",
        )}
      >
        <Eye className="size-4 shrink-0" />
        <span className={cn("flex-1 truncate text-left", collapsed && "md:hidden")}>
          {viewAsRole ? `Viendo como ${ROLE_LABELS[viewAsRole]}` : "Ver como…"}
        </span>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 w-60 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-1 shadow-xl"
        >
          <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            Previsualizar la vista de
          </li>
          {[null, ...previewableRoles].map((role) => {
            const selected = (viewAsRole ?? null) === role;
            return (
              <li key={role ?? "me"} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    pick(role);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 hover:bg-white/10"
                >
                  <span className="flex-1 truncate">
                    {role ? ROLE_LABELS[role] : `Mi vista (${ROLE_LABELS[realRole]})`}
                  </span>
                  {selected && <Check className="size-3.5 text-brand-gold" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Franja fija que recuerda que se está en vista previa y permite salir. */
export function ViewAsBanner() {
  const { viewAsRole, setViewAsRole } = useAuth();
  if (!viewAsRole) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-gold px-4 py-1.5 text-xs font-medium text-brand-black"
    >
      <span className="flex items-center gap-1.5">
        <Eye className="size-3.5" />
        Vista previa como <strong>{ROLE_LABELS[viewAsRole]}</strong> · solo lectura
      </span>
      <button
        type="button"
        onClick={() => {
          setViewAsRole(null);
        }}
        className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-0.5 font-semibold hover:bg-black/20"
      >
        <EyeOff className="size-3" /> Volver a mi vista
      </button>
    </div>
  );
}
