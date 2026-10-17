import { useRef, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismissOnOutsideClick } from "@/hooks/use-dismiss-on-outside-click";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import {
  PREVIEWABLE_TEAM_ROLES,
  useViewAsTeamRole,
  writeViewAsTeamRole,
} from "@/features/auth/utils/view-as-team-role";
import { TEAM_ROLE_LABELS, type TeamRole } from "@/features/workspace/types";

export const ROLE_LABELS: Record<Role, string> = {
  [Role.DEVELOPER]: "Developer",
  [Role.SUPER_ADMIN]: "Super administrador",
  [Role.ADMIN]: "Administrador",
  [Role.USER]: "Usuario",
};

const itemCls =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/80 hover:bg-white/10";

function MenuHeading({ children }: { children: string }) {
  return (
    <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
      {children}
    </li>
  );
}

function RadioItem({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={onSelect}
        className={itemCls}
      >
        <span className="flex-1 truncate">{label}</span>
        {selected && <Check className="size-3.5 text-brand-gold" />}
      </button>
    </li>
  );
}

/**
 * «Ver como…»: previsualiza la app con la navegación y las pantallas de un rol
 * inferior al tuyo, y además cómo se ve un equipo según tu papel DENTRO de él
 * (líder, supervisor, integrante). Son dos dimensiones independientes: se pueden
 * combinar. Mientras dura la vista previa todo es de solo lectura.
 */
export function ViewAsSwitcher({ collapsed }: { collapsed: boolean }) {
  const { realRole, viewAsRole, previewableRoles, setViewAsRole } = useAuth();
  const teamRole = useViewAsTeamRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(ref, open, () => {
    setOpen(false);
  });

  if (!realRole || previewableRoles.length === 0) {
    return null;
  }

  const active = viewAsRole !== null || teamRole !== null;
  const label = [
    viewAsRole && ROLE_LABELS[viewAsRole],
    teamRole && `${TEAM_ROLE_LABELS[teamRole]} del equipo`,
  ]
    .filter(Boolean)
    .join(" · ");

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
          collapsed ? "lg:justify-center lg:px-0 px-3" : "px-3",
          active
            ? "bg-brand-gold/15 text-brand-gold"
            : "text-sidebar-foreground/60 hover:bg-white/10 hover:text-sidebar-foreground",
        )}
      >
        <Eye className="size-4 shrink-0" />
        <span className={cn("flex-1 truncate text-left", collapsed && "lg:hidden")}>
          {active ? `Viendo como ${label}` : "Ver como…"}
        </span>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-1 shadow-xl"
        >
          <MenuHeading>Rol en el sistema</MenuHeading>
          {[null, ...previewableRoles].map((role) => (
            <RadioItem
              key={role ?? "me"}
              label={role ? ROLE_LABELS[role] : `Mi vista (${ROLE_LABELS[realRole]})`}
              selected={viewAsRole === role}
              onSelect={() => {
                setViewAsRole(role);
                setOpen(false);
              }}
            />
          ))}
          <MenuHeading>Rol en el equipo</MenuHeading>
          {[null, ...PREVIEWABLE_TEAM_ROLES].map((role: TeamRole | null) => (
            <RadioItem
              key={role ?? "real"}
              label={role ? TEAM_ROLE_LABELS[role] : "Mi acceso real"}
              selected={teamRole === role}
              onSelect={() => {
                writeViewAsTeamRole(role);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Franja fija que recuerda que se está en vista previa y permite salir. */
export function ViewAsBanner() {
  const { viewAsRole, setViewAsRole } = useAuth();
  const teamRole = useViewAsTeamRole();
  if (!viewAsRole && !teamRole) {
    return null;
  }
  const exit = () => {
    setViewAsRole(null);
    writeViewAsTeamRole(null);
  };
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-gold px-4 py-1.5 text-xs font-medium text-brand-black"
    >
      <span className="flex items-center gap-1.5">
        <Eye className="size-3.5" />
        Vista previa
        {viewAsRole && (
          <>
            {" "}
            como <strong>{ROLE_LABELS[viewAsRole]}</strong>
          </>
        )}
        {teamRole && (
          <>
            {viewAsRole ? " y" : ""} como <strong>{TEAM_ROLE_LABELS[teamRole]}</strong> del equipo
          </>
        )}{" "}
        · solo lectura
      </span>
      <button
        type="button"
        onClick={exit}
        className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-0.5 font-semibold hover:bg-black/20"
      >
        <EyeOff className="size-3" /> Volver a mi vista
      </button>
    </div>
  );
}
