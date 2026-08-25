import { useMemo, useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import type { Role } from "@/features/auth/types";
import type { AdminUser } from "../../api/users.api";
import { useResetPassword, useUpdateUser } from "../../hooks/use-admin-users";
import { EditUserModal } from "./EditUserModal";
import { getAssignableRoles, ROLE_LABEL } from "./users-ui";

// Fecha de alta en formato corto es-CO ("12 mar 2026"): la tabla solo necesita
// el día, no la hora.
function formatJoinDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────
export function UserRow({
  user,
  actorRole,
  onCredentials,
}: {
  user: AdminUser;
  actorRole: Role;
  onCredentials: (email: string, pwd: string) => void;
}) {
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // El developer/super_admin no se editan desde esta UI (evita pisar privilegios).
  const locked = user.role === "developer" || user.role === "super_admin";
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border transition-colors last:border-0 hover:bg-accent/40",
          // La cuenta inactiva se atenúa: sigue visible y accionable, pero se
          // lee de un vistazo que no puede entrar al sistema.
          !user.is_active && "bg-muted/30",
        )}
      >
        <td className="px-5 py-3">
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              !user.is_active && "text-muted-foreground",
            )}
          >
            {user.name} {user.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </td>
        <td className="px-3 py-3 text-center">
          {locked ? (
            <span className="inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          ) : (
            <select
              value={user.role}
              disabled={updateUser.isPending}
              aria-label={`Rol de ${user.name}`}
              onChange={(e) => {
                updateUser.mutate({ user, changes: { role: e.target.value as Role } });
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold disabled:opacity-50"
            >
              {assignableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          <button
            type="button"
            disabled={locked || updateUser.isPending}
            onClick={() => {
              setConfirmToggle(true);
            }}
            title={
              user.is_active
                ? "Desactivar: la cuenta deja de poder iniciar sesión"
                : "Activar: la cuenta vuelve a poder iniciar sesión"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-40",
              user.is_active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                user.is_active ? "bg-emerald-500" : "bg-slate-400",
              )}
            />
            {user.is_active ? "Activo" : "Inactivo"}
          </button>
        </td>
        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
          {/* Las cuentas privilegiadas no exponen su fecha de alta: son cuentas
              de plataforma, no personal que se dé de alta y de baja. */}
          {locked ? "—" : formatJoinDate(user.created_at)}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {!locked && (
              <button
                type="button"
                onClick={() => {
                  setShowEdit(true);
                }}
                aria-label={`Editar ${user.name} ${user.last_name}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:bg-accent"
              >
                <Pencil className="size-3" /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true);
              }}
              aria-label={`Restablecer contraseña de ${user.name}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:bg-accent"
            >
              <KeyRound className="size-3" /> Contraseña
            </button>
          </div>
        </td>
      </tr>

      {confirmToggle && (
        <ConfirmDialog
          title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
          message={
            user.is_active
              ? `${user.name} ${user.last_name} no podrá iniciar sesión mientras esté inactivo. ¿Continuar?`
              : `${user.name} ${user.last_name} volverá a poder iniciar sesión. ¿Continuar?`
          }
          confirmLabel={user.is_active ? "Desactivar" : "Activar"}
          loading={updateUser.isPending}
          errorMessage={
            updateUser.isError
              ? getErrorMessage(updateUser.error, "No se pudo actualizar el estado")
              : null
          }
          onConfirm={() => {
            updateUser.mutate(
              { user, changes: { is_active: !user.is_active } },
              {
                onSuccess: () => {
                  setConfirmToggle(false);
                },
              },
            );
          }}
          onCancel={() => {
            setConfirmToggle(false);
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Restablecer contraseña"
          message={`Se generará una contraseña temporal para ${user.name} ${user.last_name} y la actual dejará de funcionar. ¿Continuar?`}
          confirmLabel="Restablecer"
          loading={resetPassword.isPending}
          errorMessage={
            resetPassword.isError
              ? getErrorMessage(resetPassword.error, "No se pudo restablecer la contraseña")
              : null
          }
          onConfirm={() => {
            resetPassword.mutate(user.id, {
              onSuccess: (res) => {
                setConfirmReset(false);
                onCredentials(user.email, res.temporary_password);
              },
            });
          }}
          onCancel={() => {
            setConfirmReset(false);
          }}
        />
      )}

      {showEdit && (
        <EditUserModal
          user={user}
          onClose={() => {
            setShowEdit(false);
          }}
        />
      )}
    </>
  );
}
