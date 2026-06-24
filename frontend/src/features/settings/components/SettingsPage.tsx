import { useOutletContext } from "react-router";
import { Mail, Moon, ShieldCheck, Sun, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { positionLabel } from "@/features/projects/types/labels";

const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "Super administrador",
  [Role.ADMIN]: "Administrador",
  [Role.USER]: "Usuario",
};

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-brand-teal" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * Página de configuración. Por ahora muestra el perfil (solo lectura, fuente de
 * verdad: la sesión) y la apariencia (tema claro/oscuro, persistida por AppLayout).
 * Pensada para crecer con secciones futuras (seguridad, notificaciones…).
 */
export function SettingsPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Configuración"
        description="Tu perfil y las preferencias de la aplicación."
      />

      <div className="flex flex-col gap-5">
        <SettingsCard title="Perfil" description="Información de tu cuenta.">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={UserCircle2} label="Nombre" value={user?.name ?? "—"} />
            <InfoRow icon={Mail} label="Correo" value={user?.email ?? "—"} />
            <InfoRow icon={ShieldCheck} label="Rol" value={user ? ROLE_LABELS[user.role] : "—"} />
            <InfoRow
              icon={UserCircle2}
              label="Cargo"
              value={user?.position ? positionLabel(user.position) : "Sin cargo"}
            />
          </div>
        </SettingsCard>

        <SettingsCard title="Apariencia" description="Elige cómo se ve la aplicación.">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              {dark ? (
                <Moon className="size-4 text-brand-gold" />
              ) : (
                <Sun className="size-4 text-brand-gold" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tema {dark ? "oscuro" : "claro"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cambia entre el modo claro y oscuro.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              aria-label="Alternar tema oscuro"
              onClick={toggleDark}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                dark ? "bg-brand-gold" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  dark ? "translate-x-[1.375rem]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

export default SettingsPage;
