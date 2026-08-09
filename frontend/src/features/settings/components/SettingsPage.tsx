import { useState } from "react";
import { useOutletContext } from "react-router";
import { KeyRound, Mail, Moon, ShieldCheck, Sun, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useAuth, useChangePassword } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { getErrorMessage } from "@/utils/get-error-message";
import { positionLabel } from "@/features/projects/types/labels";

const fieldCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const changePassword = useChangePassword();

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length >= 8 && next === confirm && !changePassword.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        type="password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
        }}
        placeholder="Contraseña actual"
        aria-label="Contraseña actual"
        className={fieldCls}
      />
      <input
        type="password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
        }}
        placeholder="Nueva contraseña (mín. 8, con un número)"
        aria-label="Nueva contraseña"
        className={fieldCls}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
        }}
        placeholder="Confirmar nueva contraseña"
        aria-label="Confirmar nueva contraseña"
        className={fieldCls}
      />
      {mismatch && <p className="text-xs text-red-600 dark:text-red-400">No coinciden.</p>}
      {changePassword.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {getErrorMessage(changePassword.error, "No se pudo cambiar la contraseña")}
        </p>
      )}
      {changePassword.isSuccess && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Contraseña actualizada.</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {changePassword.isPending ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.DEVELOPER]: "Developer",
  [Role.SUPER_ADMIN]: "Super administrador",
  [Role.ADMIN]: "Administrador",
  [Role.USER]: "Usuario",
  [Role.CLIENT]: "Cliente",
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
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
                dark ? "bg-brand-gold" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 rounded-full bg-white shadow transition-transform",
                  dark ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Seguridad"
          description="Cambia tu contraseña. Necesitas la actual para confirmarlo."
        >
          <div className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
            <KeyRound className="size-3.5 text-brand-teal" /> Contraseña
          </div>
          <ChangePasswordForm />
        </SettingsCard>
      </div>
    </div>
  );
}

export default SettingsPage;
